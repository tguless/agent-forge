'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { AgentSummary } from '@/lib/types';

export function AgentCommandCard({ agent }: { agent: AgentSummary }) {
  const router = useRouter();
  const accent = agent.accent || '#38bdf8';
  const go = () => router.push(`/agent/${agent.slug}`);
  const pending = agent.status !== 'complete';

  return (
    <div
      role="link"
      tabIndex={0}
      className="ops-agent-card"
      style={{ ['--card-accent' as string]: accent }}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      }}
    >
      <span className="ops-box-corner ops-box-corner-tl" aria-hidden />
      <span className="ops-box-corner ops-box-corner-tr" aria-hidden />
      <span className="ops-box-corner ops-box-corner-bl" aria-hidden />
      <span className="ops-box-corner ops-box-corner-br" aria-hidden />

      <div className="ops-agent-card-header">
        <div className="ops-agent-icon-wrap" aria-hidden>
          {agent.iconPath ? (
            <img src={agent.iconPath} alt="" className="ops-agent-icon" />
          ) : (
            <span className="ops-agent-icon" style={{ color: accent, fontSize: 28 }}>
              ◆
            </span>
          )}
        </div>
        <div className="ops-agent-titles">
          <p className="ops-agent-name">{agent.title}</p>
          <p className="ops-agent-skills-file">{agent.skillsFile}</p>
        </div>
      </div>

      {pending && (
        <p className="forge-card-status" data-status={agent.status}>
          {agent.status === 'error' ? '⚠ generation failed' : '◴ forging…'}
        </p>
      )}

      <p className="ops-objective-heading"># Q1 OBJECTIVE</p>
      <p className="ops-objective-text">{agent.q1Objective || '—'}</p>

      {agent.successCriteria.length > 0 && (
        <>
          <p className="ops-section-label">Success Criteria:</p>
          <ul className="ops-list">
            {agent.successCriteria.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}

      {agent.deliverables.length > 0 && (
        <>
          <p className="ops-section-label">Deliverables:</p>
          <ul className="ops-list">
            {agent.deliverables.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default AgentCommandCard;
