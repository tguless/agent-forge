/**
 * Persistence for the per-agent SaaS access grid (agent × app × capacity).
 * Capacity values are validated against the controlled list before insert.
 */
import { getDb } from './db';
import { getApp, capacityKeysForAppType } from './catalogStore';
import type { AgentAppAccess } from './businessTypes';

type AccessRow = {
  id: number;
  agent_slug: string;
  app_id: number;
  capacity_key: string;
  rationale: string;
};

export type GrantResult =
  | { ok: true; access: AgentAppAccess }
  | { ok: false; error: string };

/**
 * Grant an agent a capacity on an app. Validates that the capacity is allowed
 * for the app's type (which keeps the grid inside the controlled superset).
 */
export function grantAccess(input: {
  agentSlug: string;
  appId: number;
  capacityKey: string;
  rationale?: string;
}): GrantResult {
  const db = getDb();
  const app = getApp(input.appId);
  if (!app) return { ok: false, error: `Unknown app id ${input.appId}` };

  const allowed = capacityKeysForAppType(app.appTypeKey);
  if (!allowed.includes(input.capacityKey)) {
    return {
      ok: false,
      error: `Capacity "${input.capacityKey}" is not valid for app type "${app.appTypeKey}". Allowed: ${allowed.join(', ')}`,
    };
  }

  const info = db
    .prepare(
      `INSERT INTO agent_app_access (agent_slug, app_id, capacity_key, rationale)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(agent_slug, app_id, capacity_key)
       DO UPDATE SET rationale = excluded.rationale`,
    )
    .run(input.agentSlug, input.appId, input.capacityKey, input.rationale ?? '');

  const id = Number(info.lastInsertRowid) || rowId(input.agentSlug, input.appId, input.capacityKey);
  return {
    ok: true,
    access: {
      id,
      agentSlug: input.agentSlug,
      appId: input.appId,
      capacityKey: input.capacityKey,
      rationale: input.rationale ?? '',
      app,
      appTypeKey: app.appTypeKey,
    },
  };
}

function rowId(agentSlug: string, appId: number, capacityKey: string): number {
  const row = getDb()
    .prepare('SELECT id FROM agent_app_access WHERE agent_slug = ? AND app_id = ? AND capacity_key = ?')
    .get(agentSlug, appId, capacityKey) as { id: number } | undefined;
  return row?.id ?? 0;
}

export function listAgentAccess(agentSlug: string): AgentAppAccess[] {
  const rows = getDb()
    .prepare('SELECT * FROM agent_app_access WHERE agent_slug = ? ORDER BY id ASC')
    .all(agentSlug) as AccessRow[];
  const capLabels = new Map(
    (getDb().prepare('SELECT key, label FROM capacities').all() as { key: string; label: string }[]).map((c) => [
      c.key,
      c.label,
    ]),
  );
  const out: AgentAppAccess[] = [];
  for (const row of rows) {
    const app = getApp(row.app_id);
    if (!app) continue;
    out.push({
      id: row.id,
      agentSlug: row.agent_slug,
      appId: row.app_id,
      capacityKey: row.capacity_key,
      rationale: row.rationale,
      app,
      appTypeKey: app.appTypeKey,
      capacityLabel: capLabels.get(row.capacity_key) ?? row.capacity_key,
    });
  }
  return out;
}

export function clearAgentAccess(agentSlug: string): void {
  getDb().prepare('DELETE FROM agent_app_access WHERE agent_slug = ?').run(agentSlug);
}
