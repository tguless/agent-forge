/**
 * Persistence for the multi-turn run timeline (agent_turns table).
 * Each ToolLoopAgent stream part becomes a typed turn the UI can replay.
 */
import { getDb } from '@/lib/db';
import type { AgentTurnPayload, TurnRole, TurnScopeType, TurnType } from './types';

type TurnRow = {
  id: number;
  scope_type: TurnScopeType;
  scope_slug: string;
  turn_index: number;
  role: TurnRole;
  turn_type: TurnType;
  content: string | null;
  tool_name: string | null;
  tool_input: string | null;
  tool_output: string | null;
  created_at: number;
};

function parseJson(value: string | null): unknown {
  if (value == null) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function rowToPayload(row: TurnRow): AgentTurnPayload {
  return {
    id: row.id,
    scopeType: row.scope_type,
    scopeSlug: row.scope_slug,
    turnIndex: row.turn_index,
    role: row.role,
    turnType: row.turn_type,
    content: row.content,
    toolName: row.tool_name,
    toolInput: parseJson(row.tool_input),
    toolOutput: parseJson(row.tool_output),
    createdAt: row.created_at,
  };
}

export function persistTurn(
  scopeType: TurnScopeType,
  scopeSlug: string,
  turnIndex: number,
  data: {
    role: TurnRole;
    turnType: TurnType;
    content?: string;
    toolName?: string;
    toolInput?: unknown;
    toolOutput?: unknown;
  },
): AgentTurnPayload {
  const now = Date.now();
  const info = getDb()
    .prepare(
      `INSERT INTO agent_turns
         (scope_type, scope_slug, turn_index, role, turn_type, content, tool_name, tool_input, tool_output, created_at)
       VALUES (@scopeType, @scopeSlug, @turnIndex, @role, @turnType, @content, @toolName, @toolInput, @toolOutput, @now)`,
    )
    .run({
      scopeType,
      scopeSlug,
      turnIndex,
      role: data.role,
      turnType: data.turnType,
      content: data.content ?? null,
      toolName: data.toolName ?? null,
      toolInput: data.toolInput !== undefined ? JSON.stringify(data.toolInput) : null,
      toolOutput: data.toolOutput !== undefined ? JSON.stringify(data.toolOutput) : null,
      now,
    });

  return {
    id: Number(info.lastInsertRowid),
    scopeType,
    scopeSlug,
    turnIndex,
    role: data.role,
    turnType: data.turnType,
    content: data.content ?? null,
    toolName: data.toolName ?? null,
    toolInput: data.toolInput,
    toolOutput: data.toolOutput,
    createdAt: now,
  };
}

/** Turns for a scope after a given id (for SSE tailing / replay-on-reconnect). */
export function listTurns(
  scopeType: TurnScopeType,
  scopeSlug: string,
  afterId = 0,
): AgentTurnPayload[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM agent_turns
       WHERE scope_type = ? AND scope_slug = ? AND id > ?
       ORDER BY id ASC`,
    )
    .all(scopeType, scopeSlug, afterId) as TurnRow[];
  return rows.map(rowToPayload);
}

/** Next turn index for a scope (so background + SSE share a monotonic counter). */
export function nextTurnIndex(scopeType: TurnScopeType, scopeSlug: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(MAX(turn_index), -1) AS maxIndex
       FROM agent_turns WHERE scope_type = ? AND scope_slug = ?`,
    )
    .get(scopeType, scopeSlug) as { maxIndex: number };
  return row.maxIndex + 1;
}
