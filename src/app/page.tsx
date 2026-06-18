'use client';

import React from 'react';
import Link from 'next/link';
import { AgentCommandCard } from '@/components/AgentCommandCard';
import { ForgeNewAgentCard } from '@/components/ForgeNewAgentCard';
import { ForgeHudHeader } from '@/components/ForgeHudHeader';
import { ForgePageShell } from '@/components/ForgePageShell';
import { ForgeTopNav } from '@/components/ForgeTopNav';
import type { AgentRosterGroup } from '@/lib/types';

export default function IndexPage() {
  const [groups, setGroups] = React.useState<AgentRosterGroup[] | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/agents', { cache: 'no-store' });
      const json = (await res.json()) as { groups: AgentRosterGroup[] };
      setGroups(json.groups);
    } catch {
      setGroups([]);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  const anyForging = (groups ?? []).some((g) =>
    g.agents.some((a) => a.status === 'queued' || a.status === 'generating'),
  );

  return (
    <ForgePageShell
      frame="hud"
      nav={
        <ForgeTopNav
          variant="dashboard"
          back="none"
          pitch={
            <>
              <strong style={{ color: 'var(--ops-text)' }}>Agent Forge</strong> — agents grouped by the
              business blueprint they serve.
            </>
          }
        />
      }
      footer={
        <footer className="ops-hud-bottom-rail">
          <span className="ops-bf-corner ops-bf-corner-bl" aria-hidden />
          <span className="ops-bf-corner ops-bf-corner-br" aria-hidden />
          <p className="ops-tagline">
            {anyForging ? 'Forge active · cards update live' : 'Describe a role · forge an agent · ship the card'}
          </p>
        </footer>
      }
    >
      <ForgeHudHeader />

      {groups === null ? (
        <p className="forge-empty">Loading roster…</p>
      ) : groups.length === 0 ? (
        <div className="ops-agent-grid">
          <ForgeNewAgentCard />
        </div>
      ) : (
        <div className="forge-roster-groups">
          {(() => {
            let cardIdx = 0;
            return groups.map((group) => (
              <section key={group.businessSlug ?? '__unassigned__'} className="forge-roster-group">
                <header className="forge-roster-group-head">
                  {group.businessSlug ? (
                    <Link href={`/business/${group.businessSlug}`} className="forge-roster-group-title">
                      {group.businessName}
                    </Link>
                  ) : (
                    <span className="forge-roster-group-title">{group.businessName}</span>
                  )}
                  {group.isPlaceholder && (
                    <span className="forge-roster-group-tag">default home</span>
                  )}
                  <span className="forge-roster-group-count">
                    {group.agents.length} agent{group.agents.length === 1 ? '' : 's'}
                  </span>
                </header>
                <div className="ops-agent-grid">
                  {group.agents.map((agent) => (
                    <AgentCommandCard key={agent.slug} agent={agent} staggerIndex={cardIdx++} />
                  ))}
                </div>
              </section>
            ));
          })()}
          <section className="forge-roster-group forge-roster-group--new">
            <div className="ops-agent-grid">
              <ForgeNewAgentCard />
            </div>
          </section>
        </div>
      )}
    </ForgePageShell>
  );
}
