import { getDb } from './db';
import type {
  AgentData,
  AgentRecord,
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
    .prepare('SELECT * FROM agents ORDER BY created_at DESC')
    .all() as Row[];
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
    };
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

export function deleteAgent(slug: string): void {
  getDb().prepare('DELETE FROM agents WHERE slug = ?').run(slug);
}
