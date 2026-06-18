'use client';

import React from 'react';
import { AgentDetailCommandCard } from '@/components/AgentDetailCommandCard';
import { AgentAccessGrid } from '@/components/AgentAccessGrid';
import { ForgePageShell } from '@/components/ForgePageShell';
import { ForgeTopNav } from '@/components/ForgeTopNav';
import { HudBox } from '@/components/HudBox';
import type { AgentData, AgentStatus } from '@/lib/types';

type DetailResponse = {
  slug: string;
  status: AgentStatus;
  data: AgentData;
  error: string | null;
  businessSlug: string | null;
  businessName: string | null;
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
      <ForgePageShell nav={<ForgeTopNav variant="dashboard" />}>
        <div className="forge-empty">
          <p>No agent found at this slug.</p>
        </div>
      </ForgePageShell>
    );
  }

  if (!detail) {
    return (
      <ForgePageShell nav={<ForgeTopNav variant="dashboard" />}>
        <div className="forge-empty">Loading command card…</div>
      </ForgePageShell>
    );
  }

  const forging = detail.status === 'queued' || detail.status === 'generating';
  const accent = detail.data.accent ?? '#8ee85a';

  return (
    <ForgePageShell
      theme="detail"
      frame="detail"
      style={{ ['--card-accent' as string]: accent }}
    >
      {forging && (
        <div className="forge-status-line forge-detail-banner">
          <span className="forge-spinner" aria-hidden /> Forging this agent… card fills in live.
        </div>
      )}
      {detail.status === 'error' && (
        <p className="forge-error forge-detail-banner">Generation failed: {detail.error}</p>
      )}
      <AgentDetailCommandCard
        embedded
        agent={detail.data}
        forging={forging}
        businessSlug={detail.businessSlug}
        businessName={detail.businessName}
      />
      <div className="forge-detail-extra">
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
    </ForgePageShell>
  );
}
