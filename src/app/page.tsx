'use client';

import React from 'react';
import Link from 'next/link';
import { AgentCommandCard } from '@/components/AgentCommandCard';
import { ForgeHudHeader } from '@/components/ForgeHudHeader';
import type { AgentSummary } from '@/lib/types';

export default function IndexPage() {
  const [agents, setAgents] = React.useState<AgentSummary[] | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/agents', { cache: 'no-store' });
      const json = (await res.json()) as { agents: AgentSummary[] };
      setAgents(json.agents);
    } catch {
      setAgents([]);
    }
  }, []);

  React.useEffect(() => {
    void load();
    // Poll while anything is still forging so cards fill in live.
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  const anyForging = (agents ?? []).some((a) => a.status === 'queued' || a.status === 'generating');

  return (
    <div className="ops-dashboard">
      <div className="forge-toolbar">
        <p className="ops-pitch" style={{ margin: 0 }}>
          <strong style={{ color: 'var(--ops-text)' }}>Agent Forge</strong> — every card below was
          generated from a job description.
        </p>
        <Link href="/new" className="forge-cta">
          + Forge new agent
        </Link>
      </div>

      <div className="ops-hud-shell">
        <span className="ops-hf-corner ops-hf-corner-tl" aria-hidden />
        <span className="ops-hf-corner ops-hf-corner-tr" aria-hidden />
        <div className="ops-hud-inner">
          <ForgeHudHeader />

          {agents === null ? (
            <p className="forge-empty">Loading roster…</p>
          ) : agents.length === 0 ? (
            <div className="forge-empty">
              <p>No agents forged yet.</p>
              <p>
                <Link href="/new" className="forge-cta">
                  Forge your first agent
                </Link>
              </p>
            </div>
          ) : (
            <div className="ops-agent-grid">
              {agents.map((agent) => (
                <AgentCommandCard key={agent.slug} agent={agent} />
              ))}
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
