'use client';

import React from 'react';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import { AnimatedDecodeLine, AnimatedFlowParagraph, createAnimateBlockSequence } from '@/lib/forgeAnimatedText';
import {
  competitorAnalysisHasContent,
  filledCompetitorSections,
  COMPETITOR_SECTIONS,
} from '@/lib/competitorSections';
import { EditableSectionHost, EditSectionButton } from '@/components/EditableSectionHost';
import type { EditableTarget } from '@/lib/editableSections';
import type { CompetitorAnalysis } from '@/lib/businessTypes';

type CompetitorAnalysisViewerProps = {
  slug: string;
  analysis: CompetitorAnalysis | undefined;
  animatePrefix?: string;
  onSaved?: () => void;
};

/** Landscape overview + collapsible per-competitor cards with subsections + sources. */
export function CompetitorAnalysisViewer({
  slug,
  analysis,
  animatePrefix = 'competitors',
  onSaved,
}: CompetitorAnalysisViewerProps) {
  const competitors = analysis?.competitors ?? [];
  const [openIds, setOpenIds] = React.useState<Set<string>>(() => new Set());
  const [editTarget, setEditTarget] = React.useState<EditableTarget | null>(null);
  const defaultOpenAppliedRef = React.useRef(false);
  const firstId = competitors[0]?.id;
  const seq = createAnimateBlockSequence(animatePrefix);

  React.useEffect(() => {
    if (!firstId) {
      defaultOpenAppliedRef.current = false;
      return;
    }
    if (defaultOpenAppliedRef.current) return;
    defaultOpenAppliedRef.current = true;
    setOpenIds(new Set([firstId]));
  }, [firstId]);

  if (!competitorAnalysisHasContent(analysis)) return null;

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="forge-competitors">
      {analysis?.landscape?.trim() && (
        <div className="forge-competitors-landscape">
          <div className="forge-plan-subpanel-head spread">
            <span className="forge-competitor-subtitle">Competitive landscape</span>
            <EditSectionButton
              label="Edit"
              onClick={() =>
                setEditTarget({
                  path: ['competitors', 'landscape'],
                  label: 'Competitive landscape',
                  content: analysis.landscape!.trim(),
                })
              }
            />
          </div>
          <ForgeMarkdown animated animatePrefix={`${animatePrefix}:landscape`}>
            {analysis.landscape}
          </ForgeMarkdown>
        </div>
      )}

      <div className="forge-competitors-list">
        {competitors.map((c) => {
          const open = openIds.has(c.id);
          const sections = filledCompetitorSections(c);
          const cardSeq = createAnimateBlockSequence(`${animatePrefix}:card:${c.id}`);
          return (
            <section key={c.id} className="forge-competitor-card">
              <button
                type="button"
                className="forge-competitor-toggle"
                aria-expanded={open}
                onClick={() => toggle(c.id)}
              >
                <span className="forge-competitor-chevron" aria-hidden>
                  {open ? '▾' : '▸'}
                </span>
                <span className="forge-competitor-name">{c.name}</span>
                {c.oneLiner && <span className="forge-competitor-oneliner">{c.oneLiner}</span>}
              </button>

              {open && (
                <div className="forge-competitor-body">
                  {(c.oneLiner || c.website) && (
                    <div className="forge-competitor-meta-row spread">
                      {c.oneLiner && (
                        <div className="forge-competitor-meta-item">
                          <span className="forge-hint">One-liner</span>
                          <EditSectionButton
                            label="Edit"
                            onClick={() =>
                              setEditTarget({
                                path: ['competitors', c.id, 'oneLiner'],
                                label: `${c.name} — One-liner`,
                                content: c.oneLiner!.trim(),
                              })
                            }
                          />
                        </div>
                      )}
                      {c.website && (
                        <div className="forge-competitor-meta-item">
                          <span className="forge-hint">Website</span>
                          <EditSectionButton
                            label="Edit"
                            onClick={() =>
                              setEditTarget({
                                path: ['competitors', c.id, 'website'],
                                label: `${c.name} — Website`,
                                content: c.website!.trim(),
                                canRewrite: false,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {c.website && (
                    <div className="forge-hint forge-competitor-website">
                      <a href={c.website} target="_blank" rel="noreferrer">
                        <AnimatedFlowParagraph seq={cardSeq} kind="website" as="span">
                          {c.website}
                        </AnimatedFlowParagraph>
                      </a>
                    </div>
                  )}

                  {sections.map((s) => (
                    <div key={s.key} className="forge-competitor-subsection">
                      <div className="spread">
                        <AnimatedDecodeLine
                          seq={cardSeq}
                          kind={`title:${s.key}`}
                          className="forge-competitor-subtitle"
                          as="h4"
                          header
                        >
                          {s.label}
                        </AnimatedDecodeLine>
                        <EditSectionButton
                          label="Edit"
                          onClick={() =>
                            setEditTarget({
                              path: ['competitors', c.id, s.key],
                              label: `${c.name} — ${s.label}`,
                              content: s.content,
                            })
                          }
                        />
                      </div>
                      <ForgeMarkdown animated animatePrefix={`${animatePrefix}:${c.id}:${s.key}`}>
                        {s.content}
                      </ForgeMarkdown>
                    </div>
                  ))}

                  {sections.length === 0 && (
                    <p className="forge-hint">
                      No subsections yet.{' '}
                      {COMPETITOR_SECTIONS.map((s) => s.label).join(', ')} can be filled by the consultant or edited here once drafted.
                    </p>
                  )}

                  {c.sources.length > 0 && (
                    <div className="forge-competitor-subsection">
                      <AnimatedDecodeLine
                        seq={cardSeq}
                        kind="sources-title"
                        className="forge-competitor-subtitle"
                        as="h4"
                        header
                      >
                        Sources
                      </AnimatedDecodeLine>
                      <ul className="forge-competitor-sources">
                        {c.sources.map((src, i) => (
                          <li key={src}>
                            <a href={src} target="_blank" rel="noreferrer">
                              <AnimatedFlowParagraph seq={cardSeq} kind={`source:${i}`} as="span">
                                {src}
                              </AnimatedFlowParagraph>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <EditableSectionHost
        slug={slug}
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => onSaved?.()}
      />
    </div>
  );
}

export default CompetitorAnalysisViewer;
