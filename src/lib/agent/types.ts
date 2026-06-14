/**
 * Shared types for the ToolLoopAgent runtime (consulting agent + forge loop).
 * Mirrors the debate-fact-checker turn timeline so the UI can render a live
 * multi-turn log for any agent run.
 */

export type TurnScopeType = 'business' | 'business-plan' | 'agent';

export type TurnRole = 'AGENT' | 'TOOL' | 'SYSTEM';

export type TurnType =
  | 'THINKING'
  | 'TOOL_CALL'
  | 'TOOL_RESULT'
  | 'MESSAGE'
  | 'COMPLETE'
  | 'ERROR';

/** One persisted turn in a run timeline (serialised for the client). */
export type AgentTurnPayload = {
  id: number;
  scopeType: TurnScopeType;
  scopeSlug: string;
  turnIndex: number;
  role: TurnRole;
  turnType: TurnType;
  content: string | null;
  toolName: string | null;
  toolInput: unknown;
  toolOutput: unknown;
  createdAt: number;
};

/** Events emitted by the generic runtime generator. */
export type TurnEvent =
  | { type: 'turn'; turn: AgentTurnPayload }
  | { type: 'done'; scopeSlug: string }
  | { type: 'cancelled'; scopeSlug: string }
  | { type: 'error'; message: string };
