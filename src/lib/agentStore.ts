import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db';
import type {
  AgentData,
  AgentRecord,
  AgentRosterGroup,
  AgentStatus,
  AgentSummary,
  GenerationEvent,
} from './types';

type Row = {
  slug: string;
  title: string;
  status: AgentStatus;
  data: string;
  skill_markdown: string;
  business_context: string;
  job_description: string;
  error: string | null;
  created_at: number;
  updated_at: number;
};

function rowToRecord(row: Row): AgentRecord {
  return {
    slug: row.slug,
    title: row.title,
    status: row.status,
    data: JSON.parse(row.data || '{}') as AgentData,
    skillMarkdown: row.skill_markdown,
    businessContext: row.business_context,
    jobDescription: row.job_description,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createAgent(input: {
  slug: string;
  title: string;
  data: AgentData;
  businessContext: string;
  jobDescription: string;
}): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO agents (slug, title, status, data, skill_markdown, business_context, job_description, error, created_at, updated_at)
     VALUES (@slug, @title, 'queued', @data, '', @businessContext, @jobDescription, NULL, @now, @now)`,
  ).run({
    slug: input.slug,
    title: input.title,
    data: JSON.stringify(input.data),
    businessContext: input.businessContext,
    jobDescription: input.jobDescription,
    now,
  });
}

export function getAgent(slug: string): AgentRecord | null {
  const row = getDb().prepare('SELECT * FROM agents WHERE slug = ?').get(slug) as Row | undefined;
  return row ? rowToRecord(row) : null;
}

export function hasAgent(slug: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM agents WHERE slug = ?').get(slug);
}

export function listAgents(): AgentSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT a.*, b.slug AS biz_slug, b.name AS biz_name, b.is_placeholder AS biz_placeholder
       FROM agents a
       LEFT JOIN businesses b ON b.slug = a.business_slug
       ORDER BY a.created_at DESC`,
    )
    .all() as (Row & {
    biz_slug: string | null;
    biz_name: string | null;
    biz_placeholder: number | null;
  })[];
  return rows.map((row) => {
    const data = JSON.parse(row.data || '{}') as AgentData;
    return {
      slug: row.slug,
      title: data.title || row.title || row.slug,
      subtitle: data.subtitle || '',
      department: data.department || '',
      accent: data.accent || '#38bdf8',
      status: row.status,
      q1Objective: data.q1Objective || '',
      successCriteria: data.successCriteria || [],
      deliverables: data.deliverables || [],
      skillsFile: data.skillsFile || `${row.slug}.skills.md`,
      iconPath: data.iconPath,
      authority: data.authority || 3,
      updatedAt: row.updated_at,
      businessSlug: row.biz_slug,
      businessName: row.biz_name,
      businessIsPlaceholder: row.biz_placeholder != null ? !!row.biz_placeholder : undefined,
    };
  });
}

/** Group agents for the homepage roster (real businesses first, placeholder / unassigned last). */
export function groupAgentsByBusiness(agents: AgentSummary[]): AgentRosterGroup[] {
  const map = new Map<string, AgentRosterGroup>();
  for (const agent of agents) {
    const key = agent.businessSlug ?? '__unassigned__';
    let group = map.get(key);
    if (!group) {
      group = {
        businessSlug: agent.businessSlug ?? null,
        businessName: agent.businessName ?? 'Unassigned',
        isPlaceholder: agent.businessIsPlaceholder ?? false,
        agents: [],
      };
      map.set(key, group);
    }
    group.agents.push(agent);
  }
  return [...map.values()].sort((a, b) => {
    if (!a.businessSlug) return 1;
    if (!b.businessSlug) return -1;
    if (a.isPlaceholder && !b.isPlaceholder) return 1;
    if (!a.isPlaceholder && b.isPlaceholder) return -1;
    return a.businessName.localeCompare(b.businessName, undefined, { sensitivity: 'base' });
  });
}

/** Merge a partial patch into the stored agent data JSON. */
export function patchAgentData(slug: string, patch: Partial<AgentData>): AgentData {
  const db = getDb();
  const current = getAgent(slug);
  if (!current) throw new Error(`Agent not found: ${slug}`);
  const next: AgentData = { ...current.data, ...patch, slug };
  db.prepare('UPDATE agents SET data = ?, title = ?, updated_at = ? WHERE slug = ?').run(
    JSON.stringify(next),
    next.title || current.title,
    Date.now(),
    slug,
  );
  return next;
}

export function setAgentStatus(slug: string, status: AgentStatus, error?: string | null): void {
  getDb()
    .prepare('UPDATE agents SET status = ?, error = ?, updated_at = ? WHERE slug = ?')
    .run(status, error ?? null, Date.now(), slug);
}

export function setSkillMarkdown(slug: string, markdown: string): void {
  getDb()
    .prepare('UPDATE agents SET skill_markdown = ?, updated_at = ? WHERE slug = ?')
    .run(markdown, Date.now(), slug);
}

export function addEvent(
  slug: string,
  type: GenerationEvent['type'],
  message: string,
): void {
  getDb()
    .prepare('INSERT INTO generation_events (slug, ts, type, message) VALUES (?, ?, ?, ?)')
    .run(slug, Date.now(), type, message);
}

export function listEvents(slug: string, afterId = 0): GenerationEvent[] {
  return getDb()
    .prepare('SELECT * FROM generation_events WHERE slug = ? AND id > ? ORDER BY id ASC')
    .all(slug, afterId) as GenerationEvent[];
}

function removeAgentAssetFiles(slug: string): void {
  const agentDir = path.join(process.cwd(), 'public', 'agents', slug);
  if (fs.existsSync(agentDir)) fs.rmSync(agentDir, { recursive: true, force: true });

  const tmpDir = path.join(process.cwd(), '.forge_tmp');
  if (!fs.existsSync(tmpDir)) return;
  for (const name of fs.readdirSync(tmpDir)) {
    if (name.startsWith(`${slug}-`)) fs.rmSync(path.join(tmpDir, name), { force: true });
  }
}

/** Delete agent row (+ cascaded events) and generated PNG assets. Returns false if slug missing. */
export function deleteAgent(slug: string): boolean {
  const result = getDb().prepare('DELETE FROM agents WHERE slug = ?').run(slug);
  if (result.changes === 0) return false;
  removeAgentAssetFiles(slug);
  return true;
}
