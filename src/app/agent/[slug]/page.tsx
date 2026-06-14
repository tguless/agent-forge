'use client';

import React from 'react';
import Link from 'next/link';
import { AgentDetailCommandCard } from '@/components/AgentDetailCommandCard';
import { AgentAccessGrid } from '@/components/AgentAccessGrid';
import { HudBox } from '@/components/HudBox';
import type { AgentData, AgentStatus } from '@/lib/types';

type DetailResponse = {
  slug: string;
  status: AgentStatus;
  data: AgentData;
  error: string | null;
};

export default function AgentDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [detail, setDetail] = React.useState<DetailResponse | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${slug}`, { cache: 'no-store' });
      if (res.status === 404) {
        setNotFound(true);
        return false;
      }
      const json = (await res.json()) as DetailResponse;
      setDetail(json);
      return json.status === 'complete' || json.status === 'error';
    } catch {
      return false;
    }
  }, [slug]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    void load().then((done) => {
      if (!done) timer = setInterval(async () => {
        const finished = await load();
        if (finished && timer) clearInterval(timer);
      }, 2500);
    });
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [load]);

  if (notFound) {
    return (
      <div className="ops-font-scope forge-empty">
        <p>No agent found at this slug.</p>
        <Link href="/" className="forge-cta">
          All agents
        </Link>
      </div>
    );
  }

  if (!detail) {
    return <div className="ops-font-scope forge-empty">Loading command card…</div>;
  }

  const forging = detail.status === 'queued' || detail.status === 'generating';

  return (
    <>
      {forging && (
        <div
          className="forge-status-line"
          style={{ maxWidth: 1180, margin: '14px auto 0', padding: '0 16px' }}
        >
          <span className="forge-spinner" aria-hidden /> Forging this agent… card fills in live.
        </div>
      )}
      {detail.status === 'error' && (
        <p className="forge-error" style={{ maxWidth: 1180, margin: '14px auto 0', padding: '0 16px' }}>
          Generation failed: {detail.error}
        </p>
      )}
      <AgentDetailCommandCard agent={detail.data} />
      <div style={{ maxWidth: 1180, margin: '18px auto 40px', padding: '0 16px' }}>
        <HudBox variant="rect">
          <h2 className="forge-label">SaaS access grid</h2>
          <p className="forge-hint" style={{ marginTop: 0 }}>
            Which business apps this agent can touch, at what capacity (least privilege).
          </p>
          <div style={{ marginTop: 10 }}>
            <AgentAccessGrid slug={slug} />
          </div>
        </HudBox>
      </div>
    </>
  );
}
