'use client';

import React from 'react';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import {
  competitorAnalysisHasContent,
  filledCompetitorSections,
} from '@/lib/competitorSections';
import type { CompetitorAnalysis } from '@/lib/businessTypes';

type CompetitorAnalysisViewerProps = {
  analysis: CompetitorAnalysis | undefined;
};

/** Landscape overview + collapsible per-competitor cards with subsections + sources. */
export function CompetitorAnalysisViewer({ analysis }: CompetitorAnalysisViewerProps) {
  const competitors = analysis?.competitors ?? [];
  const [openIds, setOpenIds] = React.useState<Set<string>>(() => new Set());
  const defaultOpenAppliedRef = React.useRef(false);
  const firstId = competitors[0]?.id;

  // Open the first competitor once when content first appears (parent polling
  // recreates the array; never re-apply after the user collapses cards).
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
          <ForgeMarkdown>{analysis.landscape}</ForgeMarkdown>
        </div>
      )}

      <div className="forge-competitors-list">
        {competitors.map((c) => {
          const open = openIds.has(c.id);
          const sections = filledCompetitorSections(c);
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
                  {c.website && (
                    <p className="forge-hint forge-competitor-website">
                      <a href={c.website} target="_blank" rel="noreferrer">
                        {c.website}
                      </a>
                    </p>
                  )}

                  {sections.map((s) => (
                    <div key={s.key} className="forge-competitor-subsection">
                      <h4 className="forge-competitor-subtitle">{s.label}</h4>
                      <ForgeMarkdown>{s.content}</ForgeMarkdown>
                    </div>
                  ))}

                  {c.sources.length > 0 && (
                    <div className="forge-competitor-subsection">
                      <h4 className="forge-competitor-subtitle">Sources</h4>
                      <ul className="forge-competitor-sources">
                        {c.sources.map((src) => (
                          <li key={src}>
                            <a href={src} target="_blank" rel="noreferrer">
                              {src}
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
    </div>
  );
}

export default CompetitorAnalysisViewer;
