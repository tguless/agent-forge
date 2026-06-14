/**
 * Per-business mutex for consulting vs plan-generation runs.
 *
 * Both flows share one lock so they cannot overlap on the same slug. Acquire
 * synchronously in start* (before voiding async work) to close double-click /
 * parallel-request races. Map lives on globalThis so dev HMR does not reset it.
 */
import { cancelRun, isRunActive } from '@/lib/agent/runRegistry';

export type BusinessRunKind = 'consult' | 'plan';

type LockStore = Map<string, BusinessRunKind>;

function lockStore(): LockStore {
  const g = globalThis as typeof globalThis & { __forgeBusinessRunLocks?: LockStore };
  if (!g.__forgeBusinessRunLocks) g.__forgeBusinessRunLocks = new Map();
  return g.__forgeBusinessRunLocks;
}

function registryKind(slug: string): BusinessRunKind | null {
  if (isRunActive('business', slug)) return 'consult';
  if (isRunActive('business-plan', slug)) return 'plan';
  return null;
}

/**
 * Atomically claim the business run slot. Returns false if another kind is active
 * or the same kind is already starting/running (unless force).
 */
export function tryAcquireBusinessRun(
  slug: string,
  kind: BusinessRunKind,
  opts?: { force?: boolean },
): boolean {
  const locks = lockStore();
  const held = locks.get(slug);
  const active = registryKind(slug);

  if (held && held !== kind) return false;
  if (active && active !== kind) return false;

  const same = held === kind || active === kind;
  if (same && !opts?.force) return false;

  if (same && opts?.force) {
    cancelRun(kind === 'consult' ? 'business' : 'business-plan', slug);
  }

  locks.set(slug, kind);
  return true;
}

export function releaseBusinessRun(slug: string, kind: BusinessRunKind): void {
  const locks = lockStore();
  if (locks.get(slug) === kind) locks.delete(slug);
}

export function isConsultInFlight(slug: string): boolean {
  return lockStore().get(slug) === 'consult' || isRunActive('business', slug);
}

export function isPlanGenerationInFlight(slug: string): boolean {
  return lockStore().get(slug) === 'plan' || isRunActive('business-plan', slug);
}

export function isAnyBusinessRunInFlight(slug: string): boolean {
  return (
    lockStore().has(slug) ||
    isRunActive('business', slug) ||
    isRunActive('business-plan', slug)
  );
}

export function activeBusinessRunKind(slug: string): BusinessRunKind | null {
  return lockStore().get(slug) ?? registryKind(slug);
}
