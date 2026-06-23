/**
 * Resolve, read, write, and build rewrite context for any editable blueprint text field.
 */
import type { Business, BusinessPlanSectionKey, CompetitorSectionKey } from '@/lib/businessTypes';
import { BUSINESS_PLAN_SECTIONS } from '@/lib/businessPlanSections';
import { COMPETITOR_SECTIONS } from '@/lib/competitorSections';
import { MARKET_SECTIONS } from '@/lib/marketAssessment';
import {
  getBusiness,
  getRole,
  listRoles,
  patchBusinessPlanSection,
  patchBusinessProfile,
  patchMarketAssessment,
  patchRole,
  setCompetitorLandscape,
  setCompetitorSection,
} from '@/lib/businessStore';

export type EditableSectionKind = 'markdown' | 'plain' | 'lines' | 'bullets';

export type ResolvedEditableSection = {
  path: string[];
  label: string;
  kind: EditableSectionKind;
  content: string;
  canRewrite: boolean;
  rewriteHint?: string;
};

type ProfileField = 'elevatorPitch' | 'summary' | 'industry' | 'businessModel' | 'valueChain';

const PROFILE_LABELS: Record<ProfileField, string> = {
  elevatorPitch: 'Elevator pitch',
  summary: 'Summary',
  industry: 'Industry',
  businessModel: 'Business model',
  valueChain: 'Value chain',
};

const ROLE_FIELDS = ['jobDescription', 'businessContext', 'rationale'] as const;
type RoleField = (typeof ROLE_FIELDS)[number];

const ROLE_LABELS: Record<RoleField, string> = {
  jobDescription: 'Job description',
  businessContext: 'Business context',
  rationale: 'Rationale',
};

function bulletsToText(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function textToBullets(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}

function linesToText(lines: string[]): string {
  return lines.join('\n');
}

function textToLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function findCompetitor(business: Business, competitorId: string) {
  return business.profile.competitorAnalysis?.competitors.find((c) => c.id === competitorId);
}

export function resolveEditableSection(slug: string, path: string[]): ResolvedEditableSection | null {
  const business = getBusiness(slug);
  if (!business || path.length === 0) return null;

  const [root, ...rest] = path;

  if (root === 'plan' && rest.length === 1) {
    const def = BUSINESS_PLAN_SECTIONS.find((s) => s.key === rest[0]);
    if (!def) return null;
    return {
      path,
      label: def.label,
      kind: 'markdown',
      content: business.profile.businessPlan?.[def.key as BusinessPlanSectionKey]?.trim() ?? '',
      canRewrite: true,
    };
  }

  if (root === 'competitors') {
    if (rest.length === 1 && rest[0] === 'landscape') {
      return {
        path,
        label: 'Competitive landscape',
        kind: 'markdown',
        content: business.profile.competitorAnalysis?.landscape?.trim() ?? '',
        canRewrite: true,
      };
    }
    if (rest.length === 3) {
      const [competitorId, sectionKey] = rest;
      const competitor = findCompetitor(business, competitorId);
      const def = COMPETITOR_SECTIONS.find((s) => s.key === sectionKey);
      if (!competitor || !def) return null;
      return {
        path,
        label: `${competitor.name} — ${def.label}`,
        kind: 'markdown',
        content: competitor.sections[sectionKey as CompetitorSectionKey]?.trim() ?? '',
        canRewrite: true,
      };
    }
    if (rest.length === 2) {
      const [competitorId, field] = rest;
      const competitor = findCompetitor(business, competitorId);
      if (!competitor) return null;
      if (field === 'oneLiner') {
        return {
          path,
          label: `${competitor.name} — One-liner`,
          kind: 'plain',
          content: competitor.oneLiner?.trim() ?? '',
          canRewrite: true,
          rewriteHint: 'Keep to one concise sentence.',
        };
      }
      if (field === 'website') {
        return {
          path,
          label: `${competitor.name} — Website`,
          kind: 'plain',
          content: competitor.website?.trim() ?? '',
          canRewrite: false,
        };
      }
    }
  }

  if (root === 'market') {
    const market = business.profile.marketAssessment;
    if (rest.length === 1) {
      const key = rest[0];
      if (key === 'headline') {
        return {
          path,
          label: 'Verdict headline',
          kind: 'plain',
          content: market?.headline?.trim() ?? '',
          canRewrite: true,
        };
      }
      if (key === 'recommendation') {
        return {
          path,
          label: 'Recommendation',
          kind: 'markdown',
          content: market?.recommendation?.trim() ?? '',
          canRewrite: true,
        };
      }
      if (key === 'pros') {
        return {
          path,
          label: 'Pros',
          kind: 'bullets',
          content: bulletsToText(market?.pros ?? []),
          canRewrite: true,
          rewriteHint: 'One bullet per line.',
        };
      }
      if (key === 'cons') {
        return {
          path,
          label: 'Cons',
          kind: 'bullets',
          content: bulletsToText(market?.cons ?? []),
          canRewrite: true,
          rewriteHint: 'One bullet per line.',
        };
      }
      const def = MARKET_SECTIONS.find((s) => s.key === key);
      if (def) {
        return {
          path,
          label: def.label,
          kind: 'markdown',
          content: market?.[def.key]?.trim() ?? '',
          canRewrite: true,
        };
      }
    }
  }

  if (root === 'profile' && rest.length === 1) {
    const field = rest[0] as ProfileField;
    if (!(field in PROFILE_LABELS)) return null;
    const p = business.profile;
    let content = '';
    let kind: EditableSectionKind = 'plain';
    if (field === 'valueChain') {
      content = linesToText(p.valueChain ?? []);
      kind = 'lines';
    } else {
      content = (p[field] as string | undefined)?.trim() ?? '';
    }
    return {
      path,
      label: PROFILE_LABELS[field],
      kind,
      content,
      canRewrite: field !== 'industry',
      rewriteHint:
        field === 'elevatorPitch' ? '30–45 seconds spoken (~50–90 words).' : undefined,
    };
  }

  if (root === 'roles' && rest.length === 2) {
    const roleId = Number(rest[0]);
    const field = rest[1] as RoleField;
    if (!Number.isFinite(roleId) || !ROLE_FIELDS.includes(field)) return null;
    const role = getRole(roleId);
    if (!role || role.businessSlug !== slug) return null;
    return {
      path,
      label: `${role.title} — ${ROLE_LABELS[field]}`,
      kind: field === 'jobDescription' ? 'markdown' : 'plain',
      content: role[field]?.trim() ?? '',
      canRewrite: true,
    };
  }

  return null;
}

export function writeEditableSection(slug: string, path: string[], rawContent: string): boolean {
  const business = getBusiness(slug);
  if (!business) return false;
  const content = rawContent.trim();
  const [root, ...rest] = path;

  if (root === 'plan' && rest.length === 1) {
    patchBusinessPlanSection(slug, rest[0] as BusinessPlanSectionKey, content);
    return true;
  }

  if (root === 'competitors') {
    if (rest.length === 1 && rest[0] === 'landscape') {
      setCompetitorLandscape(slug, content);
      return true;
    }
    if (rest.length === 3) {
      return setCompetitorSection(slug, rest[0], rest[1] as CompetitorSectionKey, content);
    }
    if (rest.length === 2) {
      const competitor = findCompetitor(business, rest[0]);
      if (!competitor) return false;
      const analysis = business.profile.competitorAnalysis ?? { competitors: [] };
      const competitors = analysis.competitors.map((c) => {
        if (c.id !== rest[0]) return c;
        if (rest[1] === 'oneLiner') return { ...c, oneLiner: content };
        if (rest[1] === 'website') return { ...c, website: content };
        return c;
      });
      patchBusinessProfile(slug, { competitorAnalysis: { ...analysis, competitors } });
      return true;
    }
  }

  if (root === 'market' && rest.length === 1) {
    const key = rest[0];
    if (key === 'pros') {
      patchMarketAssessment(slug, { pros: textToBullets(content) });
      return true;
    }
    if (key === 'cons') {
      patchMarketAssessment(slug, { cons: textToBullets(content) });
      return true;
    }
    if (key === 'headline') {
      patchMarketAssessment(slug, { headline: content });
      return true;
    }
    if (key === 'recommendation') {
      patchMarketAssessment(slug, { recommendation: content });
      return true;
    }
    if (MARKET_SECTIONS.some((s) => s.key === key)) {
      patchMarketAssessment(slug, { [key]: content });
      return true;
    }
  }

  if (root === 'profile' && rest.length === 1) {
    const field = rest[0] as ProfileField;
    if (field === 'valueChain') {
      patchBusinessProfile(slug, { valueChain: textToLines(content) });
      return true;
    }
    patchBusinessProfile(slug, { [field]: content });
    return true;
  }

  if (root === 'roles' && rest.length === 2) {
    const roleId = Number(rest[0]);
    const field = rest[1] as RoleField;
    const role = getRole(roleId);
    if (!role || role.businessSlug !== slug) return false;
    patchRole(roleId, { [field]: content });
    return true;
  }

  return false;
}

/** Full blueprint context with the target section marked for AI rewrite. */
export function buildEditableRewriteContext(business: Business, targetPath: string[]): string {
  const marker = (path: string[]) =>
    path.join('/') === targetPath.join('/') ? ' ← [THIS IS THE SECTION TO EDIT]' : '';

  const p = business.profile;

  const profileBlock = [
    `# Business: ${business.name}`,
    '',
    business.description.trim(),
    '',
    p.industry ? `Industry: ${p.industry}` : '',
    p.businessModel ? `Business model: ${p.businessModel}` : '',
    p.summary ? `Summary: ${p.summary}` : '',
    p.elevatorPitch ? `Elevator pitch: ${p.elevatorPitch}` : '',
    p.valueChain?.length ? `Value chain: ${p.valueChain.join(' → ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const planBlock = BUSINESS_PLAN_SECTIONS.filter((s) => p.businessPlan?.[s.key]?.trim())
    .map((s) => `## ${s.label} (plan/${s.key})${marker(['plan', s.key])}\n\n${p.businessPlan![s.key]!.trim()}`)
    .join('\n\n---\n\n');

  const competitorParts: string[] = [];
  if (p.competitorAnalysis?.landscape?.trim()) {
    competitorParts.push(
      `## Competitive landscape (competitors/landscape)${marker(['competitors', 'landscape'])}\n\n${p.competitorAnalysis.landscape.trim()}`,
    );
  }
  for (const c of p.competitorAnalysis?.competitors ?? []) {
    competitorParts.push(`### ${c.name} (${c.id})`);
    if (c.oneLiner) competitorParts.push(`One-liner: ${c.oneLiner}`);
    if (c.website) competitorParts.push(`Website: ${c.website}`);
    for (const s of COMPETITOR_SECTIONS) {
      const body = c.sections[s.key]?.trim();
      if (body) {
        competitorParts.push(
          `#### ${s.label} (competitors/${c.id}/${s.key})${marker(['competitors', c.id, s.key])}\n\n${body}`,
        );
      }
    }
  }

  const market = p.marketAssessment;
  const marketParts: string[] = [];
  if (market) {
    if (market.headline) {
      marketParts.push(
        `## Verdict headline (market/headline)${marker(['market', 'headline'])}\n\n${market.headline}`,
      );
    }
    for (const s of MARKET_SECTIONS) {
      const body = market[s.key]?.trim();
      if (body) {
        marketParts.push(
          `## ${s.label} (market/${s.key})${marker(['market', s.key])}\n\n${body}`,
        );
      }
    }
    if (market.pros?.length) {
      marketParts.push(
        `## Pros (market/pros)${marker(['market', 'pros'])}\n\n${bulletsToText(market.pros)}`,
      );
    }
    if (market.cons?.length) {
      marketParts.push(
        `## Cons (market/cons)${marker(['market', 'cons'])}\n\n${bulletsToText(market.cons)}`,
      );
    }
    if (market.recommendation?.trim()) {
      marketParts.push(
        `## Recommendation (market/recommendation)${marker(['market', 'recommendation'])}\n\n${market.recommendation.trim()}`,
      );
    }
  }

  const roleParts = listRoles(business.slug)
    .filter((r) => r.jobDescription?.trim() || r.businessContext?.trim())
    .map((r) => {
      const lines = [`### ${r.title} (role id ${r.id})`];
      if (r.businessContext?.trim()) {
        lines.push(
          `Business context (roles/${r.id}/businessContext)${marker(['roles', String(r.id), 'businessContext'])}\n${r.businessContext.trim()}`,
        );
      }
      if (r.jobDescription?.trim()) {
        lines.push(
          `Job description (roles/${r.id}/jobDescription)${marker(['roles', String(r.id), 'jobDescription'])}\n${r.jobDescription.trim()}`,
        );
      }
      return lines.join('\n\n');
    });

  return [
    profileBlock,
    planBlock && `# Business plan\n\n${planBlock}`,
    competitorParts.length && `# Competitor analysis\n\n${competitorParts.join('\n\n')}`,
    marketParts.length && `# Market assessment\n\n${marketParts.join('\n\n---\n\n')}`,
    roleParts.length && `# Suggested roles\n\n${roleParts.join('\n\n---\n\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
}
