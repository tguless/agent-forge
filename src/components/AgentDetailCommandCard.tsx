'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { AgentData } from '@/lib/types';
import { AgentSkillsPanel, AgentSkillsPortraitTrigger } from '@/components/AgentSkillsOverlay';
import { SegmentedProgress } from '@/components/SegmentedProgress';
import { DETAIL_SECTION_ICONS, splitQuoteParagraphs } from '@/lib/detailIcons';

function DetailPanel({
  children,
  className = '',
  danger = false,
}: {
  children: React.ReactNode;
  className?: string;
  danger?: boolean;
}) {
  return (
    <div className={`ops-detail-panel${danger ? ' ops-detail-panel--danger' : ''} ${className}`.trim()}>
      <span className="ops-detail-corner ops-detail-corner-tl" aria-hidden />
      <span className="ops-detail-corner ops-detail-corner-tr" aria-hidden />
      <span className="ops-detail-corner ops-detail-corner-bl" aria-hidden />
      <span className="ops-detail-corner ops-detail-corner-br" aria-hidden />
      <div className="ops-detail-panel-body">{children}</div>
    </div>
  );
}

function SectionHead({
  iconSrc,
  icon = '◆',
  title,
  danger = false,
}: {
  iconSrc?: string;
  icon?: string;
  title: string;
  danger?: boolean;
}) {
  const [iconFailed, setIconFailed] = React.useState(false);
  const showImg = iconSrc && !iconFailed;
  return (
    <div className={`ops-detail-section-head${danger ? ' ops-detail-section-head--danger' : ''}`}>
      {showImg ? (
        <img
          src={iconSrc}
          alt=""
          className="ops-detail-section-icon-img"
          width={44}
          height={44}
          onError={() => setIconFailed(true)}
        />
      ) : (
        <span className="ops-detail-section-icon" aria-hidden>
          {icon}
        </span>
      )}
      <h3 className="ops-detail-section-title">{title}</h3>
    </div>
  );
}

function DetailList({ items, numbered = false }: { items: string[]; numbered?: boolean }) {
  return (
    <ul className={`ops-detail-list${numbered ? ' ops-detail-list--numbered' : ''}`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function AuthorityStars({ value = 0 }: { value?: number }) {
  const clamped = Math.min(5, Math.max(0, value));
  const full = Math.floor(clamped);
  const empty = 5 - full;
  return (
    <span className="ops-detail-stars" aria-label={`Authority ${clamped} out of 5`}>
      {'★'.repeat(full)}
      {'☆'.repeat(empty)}
    </span>
  );
}

export function AgentDetailCommandCard({
  agent,
  forging = false,
}: {
  agent: AgentData;
  forging?: boolean;
}) {
  const router = useRouter();
  const accent = agent.accent ?? '#8ee85a';
  const [portraitFailed, setPortraitFailed] = React.useState(false);
  const [skillsOpen, setSkillsOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [regeneratingEmblem, setRegeneratingEmblem] = React.useState(false);
  const [emblemError, setEmblemError] = React.useState<string | null>(null);
  const [emblemCacheBust, setEmblemCacheBust] = React.useState(0);
  const emblemRequestGen = React.useRef(0);
  const showPortrait = !portraitFailed && !!agent.portraitPath;
  const outputs = (agent.outputs ?? agent.deliverables).filter(Boolean);
  const skillsAgent = {
    slug: agent.slug,
    title: agent.title,
    skillsFile: agent.skillsFile,
    accent,
  };

  React.useEffect(() => {
    setEmblemCacheBust(0);
  }, [agent.slug]);

  const emblemVersion = emblemCacheBust || Date.now();
  const emblemSrc = agent.emblemPath ? `${agent.emblemPath}?v=${emblemVersion}` : undefined;

  async function handleRegenerateEmblem() {
    const gen = ++emblemRequestGen.current;
    setRegeneratingEmblem(true);
    setEmblemError(null);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.slug)}/regenerate-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kinds: ['emblem'] }),
      });
      const json = (await res.json()) as {
        error?: string;
        results?: { emblem?: { webPath?: string; generated?: boolean; notes?: string[]; cacheBust?: number } };
      };
      if (gen !== emblemRequestGen.current) return;
      if (!res.ok) {
        setEmblemError(json.error ?? `Server error ${res.status}`);
        return;
      }
      const emblem = json.results?.emblem;
      if (emblem?.webPath) {
        setEmblemCacheBust(emblem.cacheBust ?? Date.now());
      }
      if (emblem && !emblem.generated) {
        setEmblemError(
          emblem.notes?.join(' ') || 'Gemini unavailable — placeholder emblem was used.',
        );
      }
    } catch (err) {
      if (gen !== emblemRequestGen.current) return;
      setEmblemError(err instanceof Error ? err.message : 'Failed to regenerate emblem');
    } finally {
      if (gen === emblemRequestGen.current) setRegeneratingEmblem(false);
    }
  }

  async function handleDelete() {
    const label = agent.title || agent.slug;
    if (!window.confirm(`Delete "${label}"?\n\nThis removes the command card, skill file, and generated images. This cannot be undone.`)) {
      return;
    }
    const password = window.prompt('Deletion password (default: password):')?.trim();
    if (password == null) return;
    if (!password) {
      window.alert('Deletion password is required.');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.slug)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.status === 403) {
        window.alert('Incorrect deletion password.');
        setDeleting(false);
        return;
      }
      if (!res.ok) throw new Error('delete failed');
      router.push('/');
      router.refresh();
    } catch {
      window.alert('Could not delete this agent. Try again.');
      setDeleting(false);
    }
  }

  return (
    <div className="ops-detail-page" style={{ ['--card-accent' as string]: accent }}>
      <div className="ops-detail-toolbar">
        <button type="button" className="ops-detail-back" onClick={() => router.push('/')} disabled={deleting}>
          ← All agents
        </button>
        <button
          type="button"
          className="ops-detail-delete"
          onClick={() => void handleDelete()}
          disabled={deleting}
          aria-busy={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete profile'}
        </button>
      </div>

      <div className="ops-detail-shell">
        <span className="ops-detail-corner ops-detail-corner-tl" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-tr" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-bl" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-br" aria-hidden />

        <div className="ops-detail-inner">
          <header className="ops-detail-header">
            <div className="ops-detail-brand">
              <div className="forge-wordmark">
                AGENT<span>FORGE</span>
              </div>
              <div className="ops-detail-brand-tag">{agent.department || 'Command Profile'}</div>
            </div>
            <div className="ops-detail-title-block">
              <h1 className="ops-detail-title">{agent.title}</h1>
              <p className="ops-detail-subtitle">{agent.subtitle}</p>
            </div>
            <div className="ops-detail-emblem">
              {emblemSrc ? (
                <img
                  key={emblemSrc}
                  src={emblemSrc}
                  alt=""
                  className="ops-detail-emblem-img"
                  width={252}
                  height={252}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback instanceof HTMLElement) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <span
                className="ops-detail-emblem-fallback"
                aria-hidden
                style={{ display: emblemSrc ? 'none' : 'flex' }}
              >
                ◆
              </span>
              <button
                type="button"
                className="ops-detail-emblem-regen"
                disabled={forging || deleting || regeneratingEmblem}
                aria-busy={regeneratingEmblem}
                title="Re-run Gemini emblem generation (uses saved subject when available)"
                onClick={() => void handleRegenerateEmblem()}
              >
                {regeneratingEmblem ? 'Regenerating…' : '↻ Regenerate emblem'}
              </button>
              {emblemError && (
                <p className="ops-detail-emblem-error" role="alert">
                  {emblemError}
                </p>
              )}
            </div>
          </header>

          <section className="ops-detail-hero">
            <div className="ops-detail-hero-left">
              <AgentSkillsPortraitTrigger
                agent={skillsAgent}
                open={skillsOpen}
                onToggle={() => setSkillsOpen((o) => !o)}
              >
                <div className="ops-detail-portrait-wrap">
                  {showPortrait ? (
                    <img
                      src={agent.portraitPath}
                      alt=""
                      className="ops-detail-portrait"
                      onError={() => setPortraitFailed(true)}
                    />
                  ) : (
                    <div className="ops-detail-portrait-placeholder">
                      {agent.iconPath ? (
                        <img
                          src={agent.iconPath}
                          alt=""
                          style={{ width: '60%', height: '60%', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ color: accent, fontSize: 64 }}>◆</span>
                      )}
                    </div>
                  )}
                </div>
              </AgentSkillsPortraitTrigger>
              {(agent.callsign || agent.alignment) && (
                <DetailPanel className="ops-detail-hero-meta">
                  {agent.callsign && <p>Callsign: {agent.callsign}</p>}
                  {agent.alignment && <p>Alignment: {agent.alignment}</p>}
                </DetailPanel>
              )}
            </div>

            <div className="ops-detail-hero-quote">
              {agent.quote && (
                <DetailPanel className="ops-detail-quote-panel">
                  <span className="ops-detail-quote-mark ops-detail-quote-mark--open" aria-hidden>
                    &ldquo;
                  </span>
                  <span className="ops-detail-quote-mark ops-detail-quote-mark--close" aria-hidden>
                    &rdquo;
                  </span>
                  <blockquote className="ops-detail-quote-text">
                    {splitQuoteParagraphs(agent.quote).map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </blockquote>
                </DetailPanel>
              )}
            </div>

            <DetailPanel>
              <table className="ops-detail-role-table">
                <tbody>
                  {agent.role && (
                    <tr>
                      <th>Role</th>
                      <td>{agent.role}</td>
                    </tr>
                  )}
                  {agent.alignment && (
                    <tr>
                      <th>Alignment</th>
                      <td>{agent.alignment}</td>
                    </tr>
                  )}
                  {agent.authority != null && (
                    <tr>
                      <th>Authority</th>
                      <td>
                        <AuthorityStars value={agent.authority} />
                      </td>
                    </tr>
                  )}
                  {agent.scope && (
                    <tr>
                      <th>Scope</th>
                      <td>{agent.scope}</td>
                    </tr>
                  )}
                  {(agent.escalation || agent.focus) && (
                    <tr>
                      <th>{agent.focus ? 'Focus' : 'Escalation'}</th>
                      <td>{agent.focus ?? agent.escalation}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </DetailPanel>
          </section>

          <AgentSkillsPanel agent={skillsAgent} open={skillsOpen} onClose={() => setSkillsOpen(false)} />

          <div className="ops-detail-columns">
            <div className="ops-detail-lc">
              <div className="ops-detail-split-row">
                <div className="ops-detail-col ops-detail-col--left">
                  {agent.mission && (
                    <DetailPanel>
                      <SectionHead iconSrc={DETAIL_SECTION_ICONS.mission} title="Mission" />
                      <p className="ops-detail-body-text">{agent.mission}</p>
                    </DetailPanel>
                  )}
                  {agent.primaryObjectives && agent.primaryObjectives.length > 0 && (
                    <DetailPanel>
                      <SectionHead iconSrc={DETAIL_SECTION_ICONS.objectives} title="Primary objectives" />
                      <DetailList items={agent.primaryObjectives} />
                    </DetailPanel>
                  )}
                  {agent.inputs && agent.inputs.length > 0 && outputs.length === 0 && (
                    <DetailPanel>
                      <SectionHead iconSrc={DETAIL_SECTION_ICONS.inputs} title="Inputs" />
                      <DetailList items={agent.inputs} />
                    </DetailPanel>
                  )}
                </div>

                <div className="ops-detail-col ops-detail-col--center">
                  {agent.responsibilities && agent.responsibilities.length > 0 && (
                    <DetailPanel>
                      <SectionHead iconSrc={DETAIL_SECTION_ICONS.responsibilities} title="Responsibilities" />
                      <DetailList items={agent.responsibilities} />
                    </DetailPanel>
                  )}
                  {outputs.length > 0 && !(agent.inputs && agent.inputs.length > 0) && (
                    <DetailPanel>
                      <SectionHead iconSrc={DETAIL_SECTION_ICONS.outputs} title="Outputs" />
                      <DetailList items={outputs} />
                    </DetailPanel>
                  )}
                </div>
              </div>

              {agent.inputs && agent.inputs.length > 0 && outputs.length > 0 && (
                <div className="ops-detail-io-bridge" aria-label="Inputs flow to outputs">
                  <DetailPanel className="ops-detail-io-panel">
                    <SectionHead iconSrc={DETAIL_SECTION_ICONS.inputs} title="Inputs" />
                    <DetailList items={agent.inputs} />
                  </DetailPanel>
                  <div className="ops-detail-io-arrow" aria-hidden>
                    ≫
                  </div>
                  <DetailPanel className="ops-detail-io-panel">
                    <SectionHead iconSrc={DETAIL_SECTION_ICONS.outputs} title="Outputs" />
                    <DetailList items={outputs} />
                  </DetailPanel>
                </div>
              )}

              <div className="ops-detail-split-row">
                <div className="ops-detail-col ops-detail-col--left">
                  {agent.escalateWhen && agent.escalateWhen.length > 0 && (
                    <DetailPanel danger>
                      <SectionHead iconSrc={DETAIL_SECTION_ICONS.escalate} title="Escalate when" danger />
                      <DetailList items={agent.escalateWhen} />
                    </DetailPanel>
                  )}
                </div>

                <div className="ops-detail-col ops-detail-col--center">
                  <DetailPanel>
                    <SectionHead iconSrc={DETAIL_SECTION_ICONS.q1Objective} title="Primary objective" />
                    <p className="ops-detail-body-text">{agent.q1Objective}</p>
                    {agent.successCriteria.length > 0 && (
                      <>
                        <SectionHead iconSrc={DETAIL_SECTION_ICONS.successCriteria} title="Success criteria" />
                        <DetailList items={agent.successCriteria} />
                      </>
                    )}
                  </DetailPanel>
                </div>
              </div>
            </div>

            <div className="ops-detail-col ops-detail-col--right">
              {agent.keyMetrics && agent.keyMetrics.length > 0 && (
                <DetailPanel>
                  <SectionHead iconSrc={DETAIL_SECTION_ICONS.keyMetrics} title="Key metrics" />
                  {agent.keyMetrics.map((m) => (
                    <div className="ops-detail-metric" key={m.label}>
                      <div className="ops-detail-metric-head">
                        <span className="ops-detail-metric-label">{m.label}</span>
                        <span className="ops-detail-metric-value">{m.value}</span>
                      </div>
                      {m.progress != null && <SegmentedProgress progress={m.progress} />}
                    </div>
                  ))}
                </DetailPanel>
              )}
              {agent.decisionFramework && agent.decisionFramework.length > 0 && (
                <DetailPanel>
                  <SectionHead iconSrc={DETAIL_SECTION_ICONS.decisionFramework} title="Decision framework" />
                  <DetailList items={agent.decisionFramework} numbered />
                </DetailPanel>
              )}
              <DetailPanel>
                <SectionHead iconSrc={DETAIL_SECTION_ICONS.deliverables} title="Deliverables" />
                <div className="ops-detail-deliverables">
                  <button
                    type="button"
                    className="ops-detail-file ops-detail-file--skill"
                    onClick={() => setSkillsOpen(true)}
                  >
                    {agent.skillsFile}
                  </button>
                  {agent.deliverables.map((d) => (
                    <span className="ops-detail-file" key={d}>
                      {d}
                    </span>
                  ))}
                </div>
              </DetailPanel>
            </div>
          </div>

          {agent.motto && (
            <footer className="ops-detail-footer">
              <p className="ops-detail-motto">* {agent.motto.toUpperCase()} *</p>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentDetailCommandCard;
