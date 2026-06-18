'use client';

import React from 'react';
import Link from 'next/link';
import { AgentCommandCard } from '@/components/AgentCommandCard';
import { ForgeCtaLink } from '@/components/ForgeCta';
import { ForgeNewAgentCard } from '@/components/ForgeNewAgentCard';
import { ForgeHudHeader } from '@/components/ForgeHudHeader';
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
    <div className="ops-dashboard">
      <div className="forge-toolbar">
        <p className="ops-pitch" style={{ margin: 0 }}>
          <strong style={{ color: 'var(--ops-text)' }}>Agent Forge</strong> — agents grouped by the
          business blueprint they serve.
        </p>
        <div className="forge-config-toolbar-actions">
          <ForgeCtaLink href="/config" variant="ghost">
            Configuration
          </ForgeCtaLink>
          <ForgeCtaLink href="/business" variant="ghost">
            Businesses
          </ForgeCtaLink>
          <ForgeCtaLink href="/new">+ Forge new agent</ForgeCtaLink>
        </div>
      </div>

      <div className="ops-hud-shell">
        <span className="ops-hf-corner ops-hf-corner-tl" aria-hidden />
        <span className="ops-hf-corner ops-hf-corner-tr" aria-hidden />
        <div className="ops-hud-inner">
          <ForgeHudHeader />

          {groups === null ? (
            <p className="forge-empty">Loading roster…</p>
          ) : groups.length === 0 ? (
            <div className="ops-agent-grid">
              <ForgeNewAgentCard />
            </div>
          ) : (
            <div className="forge-roster-groups">
              {groups.map((group) => (
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
                      <AgentCommandCard key={agent.slug} agent={agent} />
                    ))}
                  </div>
                </section>
              ))}
              <section className="forge-roster-group forge-roster-group--new">
                <div className="ops-agent-grid">
                  <ForgeNewAgentCard />
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className="ops-hud-bottom-rail">
          <span className="ops-bf-corner ops-bf-corner-bl" aria-hidden />
          <span className="ops-bf-corner ops-bf-corner-br" aria-hidden />
          <p className="ops-tagline">
            {anyForging ? 'Forge active · cards update live' : 'Describe a role · forge an agent · ship the card'}
          </p>
        </footer>
      </div>
    </div>
  );
}
