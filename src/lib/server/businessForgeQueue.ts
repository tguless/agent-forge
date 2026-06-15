/**
 * Sequential forge queue per business — "Forge all" creates agents immediately but
 * runs at most one LLM/image generation at a time to avoid overloading the server.
 */
import { getAgent } from '@/lib/agentStore';
import { setRoleStatus } from '@/lib/businessStore';
import { runGeneration } from '@/lib/server/agentRunner';

export type ForgeQueueItemInput = {
  roleId: number;
  agentSlug: string;
  roleTitle: string;
};

export type ForgeQueueItemStatus = 'pending' | 'running' | 'done' | 'error';

export type ForgeQueueItem = ForgeQueueItemInput & {
  status: ForgeQueueItemStatus;
  error?: string;
};

export type BusinessForgeQueueSnapshot = {
  active: boolean;
  total: number;
  completed: number;
  failed: number;
  pending: number;
  percent: number;
  current: Pick<ForgeQueueItem, 'roleId' | 'agentSlug' | 'roleTitle'> | null;
  items: ForgeQueueItem[];
};

type BusinessForgeQueue = {
  businessSlug: string;
  items: ForgeQueueItem[];
  processing: boolean;
};

function queueStore(): Map<string, BusinessForgeQueue> {
  const g = globalThis as typeof globalThis & { __forgeBusinessForgeQueues?: Map<string, BusinessForgeQueue> };
  if (!g.__forgeBusinessForgeQueues) g.__forgeBusinessForgeQueues = new Map();
  return g.__forgeBusinessForgeQueues;
}

function snapshot(queue: BusinessForgeQueue | undefined): BusinessForgeQueueSnapshot | null {
  if (!queue || queue.items.length === 0) return null;
  const total = queue.items.length;
  const completed = queue.items.filter((i) => i.status === 'done').length;
  const failed = queue.items.filter((i) => i.status === 'error').length;
  const pending = queue.items.filter((i) => i.status === 'pending').length;
  const running = queue.items.find((i) => i.status === 'running') ?? null;
  const active = queue.processing || pending > 0 || !!running;
  const percent = total === 0 ? 0 : Math.round(((completed + failed) / total) * 100);

  return {
    active,
    total,
    completed,
    failed,
    pending,
    percent: running && completed + failed < total ? Math.min(99, percent + Math.round(50 / total)) : percent,
    current: running
      ? { roleId: running.roleId, agentSlug: running.agentSlug, roleTitle: running.roleTitle }
      : null,
    items: queue.items.map((i) => ({ ...i })),
  };
}

export function getBusinessForgeQueueProgress(businessSlug: string): BusinessForgeQueueSnapshot | null {
  return snapshot(queueStore().get(businessSlug));
}

export function isBusinessForgeQueueActive(businessSlug: string): boolean {
  const snap = getBusinessForgeQueueProgress(businessSlug);
  return !!snap?.active;
}

/** Append items and start the processor if idle. Returns false if the same role is already queued. */
export function enqueueBusinessForge(
  businessSlug: string,
  inputs: ForgeQueueItemInput[],
): { ok: boolean; error?: string; queue: BusinessForgeQueueSnapshot | null } {
  if (inputs.length === 0) {
    return { ok: true, queue: getBusinessForgeQueueProgress(businessSlug) };
  }

  const store = queueStore();
  let queue = store.get(businessSlug);
  if (queue && !queue.processing && queue.items.every((i) => i.status === 'done' || i.status === 'error')) {
    store.delete(businessSlug);
    queue = undefined;
  }
  if (!queue) {
    queue = { businessSlug, items: [], processing: false };
    store.set(businessSlug, queue);
  }

  const busyIds = new Set(
    queue.items.filter((i) => i.status === 'pending' || i.status === 'running').map((i) => i.roleId),
  );
  for (const input of inputs) {
    if (busyIds.has(input.roleId)) {
      return { ok: false, error: 'One or more roles are already queued or forging.', queue: snapshot(queue) };
    }
    queue.items.push({ ...input, status: 'pending' });
  }

  if (!queue.processing) {
    void processBusinessForgeQueue(businessSlug);
  }

  return { ok: true, queue: snapshot(queue) };
}

async function processBusinessForgeQueue(businessSlug: string): Promise<void> {
  const store = queueStore();
  const queue = store.get(businessSlug);
  if (!queue || queue.processing) return;

  queue.processing = true;

  try {
    while (true) {
      const next = queue.items.find((i) => i.status === 'pending');
      if (!next) break;

      next.status = 'running';
      next.error = undefined;

      try {
        await runGeneration(next.agentSlug);
        const agent = getAgent(next.agentSlug);
        if (agent?.status === 'complete') {
          setRoleStatus(next.roleId, 'forged', next.agentSlug);
          next.status = 'done';
        } else {
          next.status = 'error';
          next.error = agent?.error ?? 'Generation did not complete successfully.';
        }
      } catch (err) {
        next.status = 'error';
        next.error = err instanceof Error ? err.message : String(err);
      }
    }
  } finally {
    queue.processing = false;
  }
}
