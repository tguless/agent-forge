'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ForgeDecodeText, ForgeFlowText, ForgeHeaderText } from '@/components/ForgeArwesText';
import { playForgeClick, unlockForgeAudio } from '@/lib/forgeBleeps';
import { useForgeInteractive } from '@/hooks/useForgeInteractive';
import type { AgentSummary } from '@/lib/types';

function CardFlowList({ items, animateId }: { items: string[]; animateId: string }) {
  return (
    <ForgeFlowText as="div" layout="block" animateId={animateId} playOnce>
      <ul className="ops-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </ForgeFlowText>
  );
}

export function AgentCommandCard({ agent }: { agent: AgentSummary }) {
  const router = useRouter();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const accent = agent.accent || '#38bdf8';
  const go = () => {
    unlockForgeAudio();
    playForgeClick();
    router.push(`/agent/${agent.slug}`);
  };
  const pending = agent.status !== 'complete';
  const statusLabel = agent.status === 'error' ? '⚠ generation failed' : '◴ forging…';

  useForgeInteractive(cardRef, {
    color: `color-mix(in srgb, ${accent} 30%, transparent)`,
    size: 320,
  });

  return (
    <div
      ref={cardRef}
      role="link"
      tabIndex={0}
      className="ops-agent-card"
      data-forge-silent
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
          <ForgeHeaderText
            as="p"
            className="ops-agent-name"
            duration={0.85}
            animateId={`${agent.slug}:title:${agent.title}`}
            playOnce
            contentStyle={{ color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
          >
            {agent.title}
          </ForgeHeaderText>
          <p className="ops-agent-skills-file">{agent.skillsFile}</p>
        </div>
      </div>

      {pending && (
        <p className="forge-card-status" data-status={agent.status}>
          <ForgeDecodeText
            animateId={`${agent.slug}:status:${agent.status}`}
            playOnce
            layout="inline"
            contentStyle={{ color: 'inherit' }}
          >
            {statusLabel}
          </ForgeDecodeText>
        </p>
      )}

      <p className="ops-objective-heading"># Q1 OBJECTIVE</p>
      <ForgeFlowText
        as="p"
        className="ops-objective-text"
        layout="block"
        animateId={`${agent.slug}:objective:${agent.q1Objective}`}
        playOnce
      >
        {agent.q1Objective || '—'}
      </ForgeFlowText>

      {agent.successCriteria.length > 0 && (
        <>
          <p className="ops-section-label">Success Criteria:</p>
          <CardFlowList
            items={agent.successCriteria.slice(0, 4)}
            animateId={`${agent.slug}:success:${agent.successCriteria.join('\x1e')}`}
          />
        </>
      )}

      {agent.deliverables.length > 0 && (
        <>
          <p className="ops-section-label">Deliverables:</p>
          <CardFlowList
            items={agent.deliverables.slice(0, 4)}
            animateId={`${agent.slug}:deliverables:${agent.deliverables.join('\x1e')}`}
          />
        </>
      )}
    </div>
  );
}

export default AgentCommandCard;
