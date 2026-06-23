/**
 * Persistence for the business blueprint layer: businesses, suggested roles,
 * the selected app stack, agent↔business linking, and placeholder bootstrap.
 */
import path from 'node:path';
import fs from 'node:fs';
import { getDb } from './db';
import { uniqueSlug, slugify } from './slug';
import { getApp } from './catalogStore';
import { deleteAgent, getAgent } from './agentStore';
import type {
  Business,
  BusinessApp,
  BusinessProfile,
  BusinessPlanSectionKey,
  BusinessRole,
  BusinessRoleStatus,
  BusinessStatus,
  BusinessSummary,
  CompetitorAnalysis,
  CompetitorSectionKey,
  MarketAssessment,
  MarketRisk,
  ViabilityVerdict,
  ConfidenceLevel,
} from './businessTypes';
import { normalizeBusinessPlan } from './businessPlanSections';

type BusinessRow = {
  slug: string;
  name: string;
  description: string;
  profile: string;
  status: BusinessStatus;
  is_placeholder: number;
  error: string | null;
  created_at: number;
  updated_at: number;
};

function rowToBusiness(row: BusinessRow): Business {
  let profile: BusinessProfile = {};
  try {
    const parsed = JSON.parse(row.profile || '{}') as BusinessProfile;
    profile = {
      ...parsed,
      businessPlan: normalizeBusinessPlan(parsed.businessPlan),
    };
  } catch {
    profile = {};
  }
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    profile,
    status: row.status,
    isPlaceholder: !!row.is_placeholder,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function hasBusiness(slug: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM businesses WHERE slug = ?').get(slug);
}

export function countBusinesses(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM businesses').get() as { n: number }).n;
}

export function createBusiness(input: {
  name: string;
  description: string;
  isPlaceholder?: boolean;
}): string {
  const db = getDb();
  const slug = uniqueSlug(input.name || input.description || 'business', hasBusiness);
  const now = Date.now();
  db.prepare(
    `INSERT INTO businesses (slug, name, description, profile, status, is_placeholder, error, created_at, updated_at)
     VALUES (?, ?, ?, '{}', 'queued', ?, NULL, ?, ?)`,
  ).run(slug, input.name || slug, input.description, input.isPlaceholder ? 1 : 0, now, now);
  return slug;
}

export function getBusiness(slug: string): Business | null {
  const row = getDb().prepare('SELECT * FROM businesses WHERE slug = ?').get(slug) as
    | BusinessRow
    | undefined;
  return row ? rowToBusiness(row) : null;
}

export function listBusinesses(): BusinessSummary[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM businesses ORDER BY created_at DESC').all() as BusinessRow[];
  return rows.map((row) => {
    const roleCount = (db.prepare('SELECT COUNT(*) AS n FROM business_roles WHERE business_slug = ?').get(row.slug) as { n: number }).n;
    const agentCount = (db.prepare('SELECT COUNT(*) AS n FROM agents WHERE business_slug = ?').get(row.slug) as { n: number }).n;
    const appCount = (db.prepare('SELECT COUNT(*) AS n FROM business_apps WHERE business_slug = ? AND is_selected = 1').get(row.slug) as { n: number }).n;
    return {
      slug: row.slug,
      name: row.name,
      description: row.description,
      status: row.status,
      isPlaceholder: !!row.is_placeholder,
      roleCount,
      agentCount,
      appCount,
      updatedAt: row.updated_at,
    };
  });
}

export function setBusinessStatus(slug: string, status: BusinessStatus, error?: string | null): void {
  getDb()
    .prepare('UPDATE businesses SET status = ?, error = ?, updated_at = ? WHERE slug = ?')
    .run(status, error ?? null, Date.now(), slug);
}

export function patchBusinessProfile(slug: string, patch: Partial<BusinessProfile>): void {
  const current = getBusiness(slug);
  if (!current) return;
  const next = { ...current.profile, ...patch };
  getDb()
    .prepare('UPDATE businesses SET profile = ?, updated_at = ? WHERE slug = ?')
    .run(JSON.stringify(next), Date.now(), slug);
}

export function patchBusinessPlanSection(
  slug: string,
  section: BusinessPlanSectionKey,
  content: string,
): void {
  const current = getBusiness(slug);
  if (!current) return;
  const plan = { ...(current.profile.businessPlan ?? {}), [section]: content.trim() };
  patchBusinessProfile(slug, { businessPlan: plan });
}

// ── Competitor analysis ─────────────────────────────────────────────────────

function currentAnalysis(slug: string): CompetitorAnalysis {
  const business = getBusiness(slug);
  return business?.profile.competitorAnalysis ?? { competitors: [] };
}

export function setCompetitorLandscape(slug: string, landscape: string): void {
  const analysis = currentAnalysis(slug);
  patchBusinessProfile(slug, {
    competitorAnalysis: { ...analysis, landscape: landscape.trim() },
  });
}

/** Create or update a competitor by name; returns its stable id. */
export function upsertCompetitor(
  slug: string,
  input: { name: string; website?: string; oneLiner?: string },
): string {
  const analysis = currentAnalysis(slug);
  const id = slugify(input.name) || `competitor-${analysis.competitors.length + 1}`;
  const competitors = [...analysis.competitors];
  const existing = competitors.find((c) => c.id === id);
  if (existing) {
    existing.name = input.name;
    if (input.website !== undefined) existing.website = input.website;
    if (input.oneLiner !== undefined) existing.oneLiner = input.oneLiner;
  } else {
    competitors.push({
      id,
      name: input.name,
      website: input.website,
      oneLiner: input.oneLiner,
      sections: {},
      sources: [],
    });
  }
  patchBusinessProfile(slug, { competitorAnalysis: { ...analysis, competitors } });
  return id;
}

/** Resolve a competitor by id or (slugified) name. */
function findCompetitorId(analysis: CompetitorAnalysis, idOrName: string): string | null {
  const slug = slugify(idOrName);
  return analysis.competitors.find((c) => c.id === idOrName || c.id === slug)?.id ?? null;
}

export function setCompetitorSection(
  slug: string,
  idOrName: string,
  section: CompetitorSectionKey,
  content: string,
  sources?: string[],
): boolean {
  const analysis = currentAnalysis(slug);
  const id = findCompetitorId(analysis, idOrName);
  if (!id) return false;
  const competitors = analysis.competitors.map((c) => {
    if (c.id !== id) return c;
    const mergedSources = sources?.length
      ? Array.from(new Set([...c.sources, ...sources]))
      : c.sources;
    return {
      ...c,
      sections: { ...c.sections, [section]: content.trim() },
      sources: mergedSources,
    };
  });
  patchBusinessProfile(slug, { competitorAnalysis: { ...analysis, competitors } });
  return true;
}

// ── Market assessment (advisory viability verdict) ──────────────────────────

function currentMarketAssessment(slug: string): MarketAssessment {
  const business = getBusiness(slug);
  return business?.profile.marketAssessment ?? {};
}

/** Merge a partial market assessment, de-duping any merged source URLs. */
export function patchMarketAssessment(slug: string, patch: Partial<MarketAssessment>): void {
  const current = currentMarketAssessment(slug);
  const next: MarketAssessment = { ...current, ...patch };
  if (patch.sources?.length) {
    next.sources = Array.from(new Set([...(current.sources ?? []), ...patch.sources]));
  }
  patchBusinessProfile(slug, { marketAssessment: next });
}

/** Append one enumerated risk to the assessment. */
export function addMarketRisk(slug: string, risk: MarketRisk): void {
  const current = currentMarketAssessment(slug);
  const risks = [...(current.risks ?? []), risk];
  patchBusinessProfile(slug, { marketAssessment: { ...current, risks } });
}

/** Record the advisory verdict + pros/cons/recommendation in one call. */
export function setViabilityVerdict(
  slug: string,
  input: {
    verdict: ViabilityVerdict;
    confidence?: ConfidenceLevel;
    headline?: string;
    pros?: string[];
    cons?: string[];
    recommendation?: string;
  },
): void {
  const current = currentMarketAssessment(slug);
  patchBusinessProfile(slug, {
    marketAssessment: {
      ...current,
      verdict: input.verdict,
      confidence: input.confidence ?? current.confidence,
      headline: input.headline?.trim() || current.headline,
      pros: input.pros?.length ? input.pros : current.pros,
      cons: input.cons?.length ? input.cons : current.cons,
      recommendation: input.recommendation?.trim() || current.recommendation,
    },
  });
}

// ── Roles ─────────────────────────────────────────────────────────────────────

type RoleRow = {
  id: number;
  business_slug: string;
  title: string;
  business_context: string;
  job_description: string;
  authority_hint: number;
  rationale: string;
  status: BusinessRoleStatus;
  agent_slug: string | null;
  created_at: number;
};

function rowToRole(row: RoleRow): BusinessRole {
  return {
    id: row.id,
    businessSlug: row.business_slug,
    title: row.title,
    businessContext: row.business_context,
    jobDescription: row.job_description,
    authorityHint: row.authority_hint,
    rationale: row.rationale,
    status: row.status,
    agentSlug: row.agent_slug,
    createdAt: row.created_at,
  };
}

export function addRole(input: {
  businessSlug: string;
  title: string;
  businessContext: string;
  jobDescription: string;
  authorityHint?: number;
  rationale?: string;
}): BusinessRole {
  const info = getDb()
    .prepare(
      `INSERT INTO business_roles
         (business_slug, title, business_context, job_description, authority_hint, rationale, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'suggested', ?)`,
    )
    .run(
      input.businessSlug,
      input.title,
      input.businessContext,
      input.jobDescription,
      input.authorityHint ?? 3,
      input.rationale ?? '',
      Date.now(),
    );
  return getRole(Number(info.lastInsertRowid))!;
}

export function getRole(id: number): BusinessRole | null {
  const row = getDb().prepare('SELECT * FROM business_roles WHERE id = ?').get(id) as RoleRow | undefined;
  return row ? rowToRole(row) : null;
}

export function listRoles(businessSlug: string): BusinessRole[] {
  const rows = getDb()
    .prepare('SELECT * FROM business_roles WHERE business_slug = ? ORDER BY id ASC')
    .all(businessSlug) as RoleRow[];
  return rows.map(rowToRole);
}

export function setRoleStatus(id: number, status: BusinessRoleStatus, agentSlug?: string | null): void {
  if (agentSlug !== undefined) {
    getDb().prepare('UPDATE business_roles SET status = ?, agent_slug = ? WHERE id = ?').run(status, agentSlug, id);
  } else {
    getDb().prepare('UPDATE business_roles SET status = ? WHERE id = ?').run(status, id);
  }
}

export function patchRole(
  id: number,
  patch: Partial<Pick<BusinessRole, 'title' | 'jobDescription' | 'businessContext' | 'rationale' | 'authorityHint'>>,
): BusinessRole | null {
  const current = getRole(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  getDb()
    .prepare(
      `UPDATE business_roles
       SET title = ?, business_context = ?, job_description = ?, authority_hint = ?, rationale = ?
       WHERE id = ?`,
    )
    .run(
      next.title,
      next.businessContext,
      next.jobDescription,
      next.authorityHint,
      next.rationale ?? '',
      id,
    );
  return getRole(id);
}

/** Promote roles stuck on `forging` when their agent already finished. */
export function reconcileRoleForgeStatuses(businessSlug: string): void {
  for (const role of listRoles(businessSlug)) {
    if (role.status !== 'forging' || !role.agentSlug) continue;
    const agent = getAgent(role.agentSlug);
    if (agent?.status === 'complete') {
      setRoleStatus(role.id, 'forged', role.agentSlug);
    }
  }
}

// ── App stack ───────────────────────────────────────────────────────────────

type BusinessAppRow = {
  id: number;
  business_slug: string;
  app_type_key: string;
  app_id: number;
  is_agent_default: number;
  is_selected: number;
  rationale: string;
};

export function listBusinessApps(businessSlug: string): BusinessApp[] {
  const rows = getDb()
    .prepare('SELECT * FROM business_apps WHERE business_slug = ? ORDER BY app_type_key, id')
    .all(businessSlug) as BusinessAppRow[];
  return rows
    .map((row) => {
      const app = getApp(row.app_id);
      if (!app) return null;
      return {
        id: row.id,
        businessSlug: row.business_slug,
        appTypeKey: row.app_type_key,
        appId: row.app_id,
        isAgentDefault: !!row.is_agent_default,
        isSelected: !!row.is_selected,
        rationale: row.rationale,
        app,
      } satisfies BusinessApp;
    })
    .filter((x): x is BusinessApp => x !== null);
}

/**
 * Add an app to a business's stack. When `isDefault`, it becomes the agent's
 * default + the selected app for its type (clearing prior default/selection).
 */
export function addBusinessApp(input: {
  businessSlug: string;
  appId: number;
  appTypeKey: string;
  isDefault?: boolean;
  rationale?: string;
}): void {
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM business_apps WHERE business_slug = ? AND app_id = ?')
    .get(input.businessSlug, input.appId) as { id: number } | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO business_apps (business_slug, app_type_key, app_id, is_agent_default, is_selected, rationale)
       VALUES (?, ?, ?, 0, 0, ?)`,
    ).run(input.businessSlug, input.appTypeKey, input.appId, input.rationale ?? '');
  } else if (input.rationale) {
    db.prepare('UPDATE business_apps SET rationale = ? WHERE id = ?').run(input.rationale, existing.id);
  }

  if (input.isDefault) {
    db.prepare(
      'UPDATE business_apps SET is_agent_default = 0, is_selected = 0 WHERE business_slug = ? AND app_type_key = ?',
    ).run(input.businessSlug, input.appTypeKey);
    db.prepare(
      'UPDATE business_apps SET is_agent_default = 1, is_selected = 1 WHERE business_slug = ? AND app_id = ?',
    ).run(input.businessSlug, input.appId);
  }
}

/** User override: select a specific app for its type (clears siblings). Returns false if invalid. */
export function selectBusinessApp(businessSlug: string, appId: number): boolean {
  const db = getDb();
  const row = db
    .prepare('SELECT app_type_key FROM business_apps WHERE business_slug = ? AND app_id = ?')
    .get(businessSlug, appId) as { app_type_key: string } | undefined;
  if (!row) return false;
  db.prepare('UPDATE business_apps SET is_selected = 0 WHERE business_slug = ? AND app_type_key = ?').run(
    businessSlug,
    row.app_type_key,
  );
  db.prepare('UPDATE business_apps SET is_selected = 1 WHERE business_slug = ? AND app_id = ?').run(
    businessSlug,
    appId,
  );
  return true;
}

/** The effective (user-overridable) selected stack for a business. */
export function selectedBusinessApps(businessSlug: string): BusinessApp[] {
  return listBusinessApps(businessSlug).filter((a) => a.isSelected);
}

// ── Agent ↔ business linking + placeholder bootstrap ──────────────────────────

export function setAgentBusiness(agentSlug: string, businessSlug: string): void {
  getDb().prepare('UPDATE agents SET business_slug = ? WHERE slug = ?').run(businessSlug, agentSlug);
}

export type BusinessAgentSummary = {
  slug: string;
  title: string;
  status: string;
  iconPath?: string;
  portraitPath?: string;
  emblemPath?: string;
  callsign?: string;
  accent?: string;
  authority: number;
  skillsFile?: string;
  department?: string;
  roleId?: number | null;
  createdAt: number;
  updatedAt: number;
};

export function listAgentsByBusiness(businessSlug: string): BusinessAgentSummary[] {
  const rows = getDb()
    .prepare('SELECT slug, title, status, data, created_at, updated_at FROM agents WHERE business_slug = ? ORDER BY created_at DESC')
    .all(businessSlug) as {
    slug: string;
    title: string;
    status: string;
    data: string;
    created_at: number;
    updated_at: number;
  }[];
  return rows.map((r) => {
    let data: {
      title?: string;
      iconPath?: string;
      portraitPath?: string;
      emblemPath?: string;
      callsign?: string;
      accent?: string;
      authority?: number;
      skillsFile?: string;
      department?: string;
    } = {};
    try {
      data = JSON.parse(r.data || '{}');
    } catch {
      data = {};
    }
    return {
      slug: r.slug,
      title: data.title || r.title || r.slug,
      status: r.status,
      iconPath: data.iconPath,
      portraitPath: data.portraitPath,
      emblemPath: data.emblemPath,
      callsign: data.callsign,
      accent: data.accent,
      authority: data.authority ?? 3,
      skillsFile: data.skillsFile,
      department: data.department,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export function getAgentBusinessSlug(agentSlug: string): string | null {
  const row = getDb().prepare('SELECT business_slug FROM agents WHERE slug = ?').get(agentSlug) as
    | { business_slug: string | null }
    | undefined;
  return row?.business_slug ?? null;
}

export function backfillOrphanAgents(toSlug: string): number {
  const info = getDb()
    .prepare("UPDATE agents SET business_slug = ? WHERE business_slug IS NULL OR business_slug = ''")
    .run(toSlug);
  return info.changes;
}

function removeBusinessAssetFiles(slug: string): void {
  const businessDir = path.join(process.cwd(), 'public', 'businesses', slug);
  if (fs.existsSync(businessDir)) fs.rmSync(businessDir, { recursive: true, force: true });
}

/**
 * Delete a business blueprint, its forged agents, timeline turns, and generated
 * plaque assets. Returns false if missing; throws if the placeholder home business.
 */
export function deleteBusiness(slug: string): boolean {
  const business = getBusiness(slug);
  if (!business) return false;
  if (business.isPlaceholder) {
    throw new Error('The default placeholder business cannot be deleted.');
  }

  const db = getDb();
  const agentRows = db
    .prepare('SELECT slug FROM agents WHERE business_slug = ?')
    .all(slug) as { slug: string }[];
  for (const { slug: agentSlug } of agentRows) {
    deleteAgent(agentSlug);
  }

  db.prepare(
    `DELETE FROM agent_turns WHERE scope_slug = ? AND scope_type IN ('business', 'business-plan')`,
  ).run(slug);

  const result = db.prepare('DELETE FROM businesses WHERE slug = ?').run(slug);
  if (result.changes === 0) return false;

  removeBusinessAssetFiles(slug);
  return true;
}

export const PLACEHOLDER_DESCRIPTION =
  'Internal back-office operations for a generic small business — the default home for agents forged without a specific business attached.';

/**
 * Ensure at least one (placeholder) business exists and adopt any orphan agents.
 * Returns the placeholder slug. The consulting run kickoff is wired by the caller
 * (it lives in the agent layer to avoid a store→runner import cycle).
 */
export function ensurePlaceholderBusiness(): { slug: string; created: boolean } {
  const db = getDb();
  const existing = db
    .prepare("SELECT slug FROM businesses WHERE is_placeholder = 1 ORDER BY created_at ASC LIMIT 1")
    .get() as { slug: string } | undefined;
  if (existing) {
    backfillOrphanAgents(existing.slug);
    return { slug: existing.slug, created: false };
  }
  const slug = createBusiness({
    name: 'House Operations',
    description: PLACEHOLDER_DESCRIPTION,
    isPlaceholder: true,
  });
  backfillOrphanAgents(slug);
  return { slug, created: true };
}
