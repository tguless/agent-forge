'use client';

import React from 'react';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import {
  MARKET_SECTIONS,
  marketAssessmentHasContent,
  sortRisksBySeverity,
  viabilityVerdictDef,
} from '@/lib/marketAssessment';
import type { MarketAssessment } from '@/lib/businessTypes';

type MarketAssessmentViewerProps = {
  assessment: MarketAssessment | undefined;
};

/**
 * Advisory viability read: verdict badge + headline, sized market / demand /
 * timing, a pros vs cons ledger, ranked risks, and a closing recommendation.
 * Explicitly framed as informational — the operator makes the call.
 */
export function MarketAssessmentViewer({ assessment }: MarketAssessmentViewerProps) {
  if (!marketAssessmentHasContent(assessment) || !assessment) return null;

  const verdict = viabilityVerdictDef(assessment.verdict);
  const risks = sortRisksBySeverity(assessment.risks ?? []);
  const pros = assessment.pros ?? [];
  const cons = assessment.cons ?? [];

  return (
    <div className="forge-market">
      {verdict && (
        <div className={`forge-verdict forge-verdict--${verdict.tone}`}>
          <div className="forge-verdict-head">
            <span className="forge-verdict-badge">{verdict.label}</span>
            {assessment.confidence && (
              <span className="forge-verdict-confidence">
                {assessment.confidence} confidence
              </span>
            )}
          </div>
          {assessment.headline && <p className="forge-verdict-headline">{assessment.headline}</p>}
          <p className="forge-verdict-disclaimer">
            Advisory only — pros, cons, and risks to inform your call. Agent Forge does not decide for you.
          </p>
        </div>
      )}

      {MARKET_SECTIONS.map((s) => {
        const body = assessment[s.key];
        if (!body?.trim()) return null;
        return (
          <section key={s.key} id={s.anchor} className="forge-market-section">
            <h4 className="forge-market-subtitle">{s.label}</h4>
            <ForgeMarkdown>{body}</ForgeMarkdown>
          </section>
        );
      })}

      {(pros.length > 0 || cons.length > 0) && (
        <div className="forge-proscons">
          {pros.length > 0 && (
            <div className="forge-proscons-col forge-proscons-col--pro">
              <h4 className="forge-market-subtitle">Pros</h4>
              <ul className="forge-proscons-list">
                {pros.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {cons.length > 0 && (
            <div className="forge-proscons-col forge-proscons-col--con">
              <h4 className="forge-market-subtitle">Cons</h4>
              <ul className="forge-proscons-list">
                {cons.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {risks.length > 0 && (
        <section className="forge-market-section">
          <h4 className="forge-market-subtitle">Risks</h4>
          <ul className="forge-risk-list">
            {risks.map((r, i) => (
              <li key={i} className="forge-risk-item">
                <div className="forge-risk-head">
                  <span className={`forge-risk-sev forge-risk-sev--${r.severity}`}>
                    {r.severity}
                  </span>
                  {r.likelihood && (
                    <span className="forge-risk-likelihood">{r.likelihood} likelihood</span>
                  )}
                  <span className="forge-risk-text">{r.risk}</span>
                </div>
                {r.mitigation && (
                  <p className="forge-risk-mitigation">
                    <strong>Mitigation:</strong> {r.mitigation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {assessment.recommendation?.trim() && (
        <section className="forge-market-section forge-market-recommendation">
          <h4 className="forge-market-subtitle">Recommendation</h4>
          <ForgeMarkdown>{assessment.recommendation}</ForgeMarkdown>
        </section>
      )}

      {(assessment.sources?.length ?? 0) > 0 && (
        <section className="forge-market-section">
          <h4 className="forge-market-subtitle">Sources</h4>
          <ul className="forge-competitor-sources">
            {assessment.sources!.map((src) => (
              <li key={src}>
                <a href={src} target="_blank" rel="noreferrer">
                  {src}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default MarketAssessmentViewer;
