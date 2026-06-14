/**
 * In-memory registry of active agent runs (single Node process / one container).
 * Keyed by `${scopeType}:${scopeSlug}` so businesses and agents share one map.
 * Mirrors debate-fact-checker's run-registry.
 */
import type { TurnScopeType } from './types';

function key(scopeType: TurnScopeType, scopeSlug: string): string {
  return `${scopeType}:${scopeSlug}`;
}

const activeRuns = new Map<string, AbortController>();

/** Register a run, aborting any prior run for the same scope. Returns its controller. */
export function registerRun(scopeType: TurnScopeType, scopeSlug: string): AbortController {
  const k = key(scopeType, scopeSlug);
  activeRuns.get(k)?.abort();
  const controller = new AbortController();
  activeRuns.set(k, controller);
  return controller;
}

export function unregisterRun(scopeType: TurnScopeType, scopeSlug: string): void {
  activeRuns.delete(key(scopeType, scopeSlug));
}

export function cancelRun(scopeType: TurnScopeType, scopeSlug: string): boolean {
  const k = key(scopeType, scopeSlug);
  const controller = activeRuns.get(k);
  if (!controller) return false;
  controller.abort();
  activeRuns.delete(k);
  return true;
}

export function isRunActive(scopeType: TurnScopeType, scopeSlug: string): boolean {
  return activeRuns.has(key(scopeType, scopeSlug));
}
