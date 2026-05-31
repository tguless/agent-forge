'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type SkillsAgent = {
  slug: string;
  title: string;
  skillsFile: string;
  accent?: string;
};

type TriggerProps = {
  agent: SkillsAgent;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

/** Tap target on commander portrait — opens the skill module. */
export function AgentSkillsPortraitTrigger({ agent, open, onToggle, children }: TriggerProps) {
  const accent = agent.accent ?? '#8ee85a';
  return (
    <button
      type="button"
      className={`ops-detail-portrait-trigger${open ? ' ops-detail-portrait-trigger--active' : ''}`}
      style={{ ['--skills-accent' as string]: accent }}
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`ops-skills-panel-${agent.slug}`}
      aria-label={`${open ? 'Close' : 'Open'} ${agent.title} skill module`}
    >
      {children}
      <span className="ops-detail-portrait-tap-hint" aria-hidden>
        <span className="ops-detail-portrait-tap-icon">◈</span>
        {open ? 'Close skill module' : 'Tap · Skill module'}
      </span>
    </button>
  );
}

type PanelProps = {
  agent: SkillsAgent;
  open: boolean;
  onClose: () => void;
};

/** Full-screen readable skill panel, content loaded from the API. */
export function AgentSkillsPanel({ agent, open, onClose }: PanelProps) {
  const [content, setContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const accent = agent.accent ?? '#8ee85a';

  React.useEffect(() => setMounted(true), []);
  const panelId = `ops-skills-panel-${agent.slug}`;
  const skillsUrl = `/api/agents/${agent.slug}/skill`;

  const loadSkills = React.useCallback(async () => {
    if (content || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(skillsUrl);
      if (!res.ok) throw new Error(`Skill module offline (${res.status})`);
      setContent(await res.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skill module');
    } finally {
      setLoading(false);
    }
  }, [content, loading, skillsUrl]);

  React.useEffect(() => {
    if (open) void loadSkills();
  }, [open, loadSkills]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      id={panelId}
      className="ops-detail-skills-panel"
      style={{ ['--skills-accent' as string]: accent }}
      role="dialog"
      aria-label={`${agent.title} skill module`}
      aria-modal="true"
    >
      <div className="ops-detail-skills-panel-backdrop" aria-hidden onClick={onClose} />
      <div className="ops-detail-skills-panel-sheet">
        <span className="ops-detail-corner ops-detail-corner-tl" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-tr" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-bl" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-br" aria-hidden />
        <div className="ops-detail-skills-overlay-scan" aria-hidden />

        <header className="ops-detail-skills-overlay-head">
          <div className="ops-detail-skills-overlay-head-row">
            <div>
              <span className="ops-detail-skills-overlay-tag">TACTICAL SKILL MODULE</span>
              <h2 className="ops-detail-skills-overlay-title">{agent.title}</h2>
              <code className="ops-detail-skills-overlay-file">{agent.skillsFile}</code>
            </div>
            <button
              type="button"
              className="ops-detail-skills-close"
              onClick={onClose}
              aria-label="Close skill module"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="ops-detail-skills-overlay-body">
          {loading && <p className="ops-detail-skills-overlay-status">Decrypting skill payload…</p>}
          {error && (
            <p className="ops-detail-skills-overlay-status ops-detail-skills-overlay-status--error">
              {error}
            </p>
          )}
          {content && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children: c }) => <h1 className="ops-skills-h1">{c}</h1>,
                h2: ({ children: c }) => <h2 className="ops-skills-h2">{c}</h2>,
                h3: ({ children: c }) => <h3 className="ops-skills-h3">{c}</h3>,
                p: ({ children: c }) => <p className="ops-skills-p">{c}</p>,
                ul: ({ children: c }) => <ul className="ops-skills-ul">{c}</ul>,
                ol: ({ children: c }) => <ol className="ops-skills-ol">{c}</ol>,
                li: ({ children: c }) => <li className="ops-skills-li">{c}</li>,
                code: ({ className, children: c }) =>
                  className ? (
                    <code className={`ops-skills-code ${className}`}>{c}</code>
                  ) : (
                    <code className="ops-skills-code">{c}</code>
                  ),
                pre: ({ children: c }) => <pre className="ops-skills-pre">{c}</pre>,
                strong: ({ children: c }) => <strong className="ops-skills-strong">{c}</strong>,
                table: ({ children: c }) => (
                  <div className="ops-skills-table-wrap">
                    <table className="ops-skills-table">{c}</table>
                  </div>
                ),
                thead: ({ children: c }) => <thead className="ops-skills-thead">{c}</thead>,
                tbody: ({ children: c }) => <tbody className="ops-skills-tbody">{c}</tbody>,
                tr: ({ children: c }) => <tr className="ops-skills-tr">{c}</tr>,
                th: ({ children: c }) => <th className="ops-skills-th">{c}</th>,
                td: ({ children: c }) => <td className="ops-skills-td">{c}</td>,
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>

        <footer className="ops-detail-skills-overlay-foot">
          Agent Forge · generated tactical skill module
        </footer>
      </div>
    </div>,
    document.body,
  );
}
