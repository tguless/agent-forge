'use client';

import React from 'react';

export type ForgeQueueSnapshot = {
  active: boolean;
  total: number;
  completed: number;
  failed: number;
  pending: number;
  percent: number;
  current: { roleId: number; agentSlug: string; roleTitle: string } | null;
};

/** Batch forge progress — one agent generation at a time. */
export function ForgeQueueProgress({ queue }: { queue: ForgeQueueSnapshot }) {
  const done = queue.completed + queue.failed;
  const label = queue.current
    ? `Forging ${Math.min(done + 1, queue.total)} of ${queue.total}: ${queue.current.roleTitle}`
    : queue.active
      ? `Preparing forge queue (${done}/${queue.total})…`
      : `Forge queue finished (${queue.completed} ready${queue.failed ? `, ${queue.failed} failed` : ''})`;

  return (
    <div className="forge-forge-queue" role="status" aria-live="polite">
      <div className="forge-forge-queue-head">
        <span className="forge-status-line">
          {queue.active ? <span className="forge-spinner" aria-hidden /> : null}
          {label}
        </span>
        <span className="forge-forge-queue-pct">{queue.percent}%</span>
      </div>
      <div className="forge-forge-queue-track" aria-hidden>
        <div className="forge-forge-queue-fill" style={{ width: `${queue.percent}%` }} />
      </div>
      {queue.failed > 0 && !queue.active ? (
        <p className="forge-hint forge-forge-queue-note">
          {queue.failed} role(s) failed — open the agent card to retry.
        </p>
      ) : null}
    </div>
  );
}

export default ForgeQueueProgress;
