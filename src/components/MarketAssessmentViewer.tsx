'use client';

import React from 'react';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import {
  AnimatedDecodeLine,
  AnimatedFlowParagraph,
  createAnimateBlockSequence,
} from '@/lib/forgeAnimatedText';
import {
  MARKET_SECTIONS,
  marketAssessmentHasContent,
  sortRisksBySeverity,
  viabilityVerdictDef,
} from '@/lib/marketAssessment';
import type { MarketAssessment } from '@/lib/businessTypes';

type MarketAssessmentViewerProps = {
  assessment: MarketAssessment | undefined;
  animatePrefix?: string;
};

/**
 * Advisory viability read: verdict badge + headline, sized market / demand /
 * timing, a pros vs cons ledger, ranked risks, and a closing recommendation.
 * Explicitly framed as informational — the operator makes the call.
 */
export function MarketAssessmentViewer({
  assessment,
  animatePrefix = 'market',
}: MarketAssessmentViewerProps) {
  if (!marketAssessmentHasContent(assessment) || !assessment) return null;

  const seq = createAnimateBlockSequence(animatePrefix);
  const verdict = viabilityVerdictDef(assessment.verdict);
  const risks = sortRisksBySeverity(assessment.risks ?? []);
  const pros = assessment.pros ?? [];
  const cons = assessment.cons ?? [];

  return (
    <div className="forge-market">
      {verdict && (
        <div className={`forge-verdict forge-verdict--${verdict.tone}`}>
          <div className="forge-verdict-head">
            <AnimatedDecodeLine seq={seq} kind="verdict-badge" className="forge-verdict-badge" as="span">
              {verdict.label}
            </AnimatedDecodeLine>
            {assessment.confidence && (
              <AnimatedDecodeLine
                seq={seq}
                kind="verdict-confidence"
                className="forge-verdict-confidence"
                as="span"
              >
                {`${assessment.confidence} confidence`}
              </AnimatedDecodeLine>
            )}
          </div>
          {assessment.headline && (
            <AnimatedFlowParagraph seq={seq} kind="verdict-headline" className="forge-verdict-headline">
              {assessment.headline}
            </AnimatedFlowParagraph>
          )}
          <AnimatedFlowParagraph seq={seq} kind="verdict-disclaimer" className="forge-verdict-disclaimer">
            Advisory only — pros, cons, and risks to inform your call. Agent Forge does not decide for you.
          </AnimatedFlowParagraph>
        </div>
      )}

      {MARKET_SECTIONS.map((s) => {
        const body = assessment[s.key];
        if (!body?.trim()) return null;
        return (
          <section key={s.key} id={s.anchor} className="forge-market-section">
            <AnimatedDecodeLine
              seq={seq}
              kind={`section-title:${s.key}`}
              className="forge-market-subtitle"
              as="h4"
              header
            >
              {s.label}
            </AnimatedDecodeLine>
            <ForgeMarkdown animated animatePrefix={`${animatePrefix}:${s.key}`}>
              {body}
            </ForgeMarkdown>
          </section>
        );
      })}

      {(pros.length > 0 || cons.length > 0) && (
        <div className="forge-proscons">
          {pros.length > 0 && (
            <div className="forge-proscons-col forge-proscons-col--pro">
              <AnimatedDecodeLine seq={seq} kind="pros-title" className="forge-market-subtitle" as="h4" header>
                Pros
              </AnimatedDecodeLine>
              <ul className="forge-proscons-list">
                {pros.map((p, i) => (
                  <li key={i}>
                    <AnimatedFlowParagraph seq={seq} kind={`pro:${i}`} as="span">
                      {p}
                    </AnimatedFlowParagraph>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cons.length > 0 && (
            <div className="forge-proscons-col forge-proscons-col--con">
              <AnimatedDecodeLine seq={seq} kind="cons-title" className="forge-market-subtitle" as="h4" header>
                Cons
              </AnimatedDecodeLine>
              <ul className="forge-proscons-list">
                {cons.map((c, i) => (
                  <li key={i}>
                    <AnimatedFlowParagraph seq={seq} kind={`con:${i}`} as="span">
                      {c}
                    </AnimatedFlowParagraph>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {risks.length > 0 && (
        <section className="forge-market-section">
          <AnimatedDecodeLine seq={seq} kind="risks-title" className="forge-market-subtitle" as="h4" header>
            Risks
          </AnimatedDecodeLine>
          <ul className="forge-risk-list">
            {risks.map((r, i) => (
              <li key={i} className="forge-risk-item">
                <div className="forge-risk-head">
                  <AnimatedDecodeLine
                    seq={seq}
                    kind={`risk-sev:${i}`}
                    className={`forge-risk-sev forge-risk-sev--${r.severity}`}
                    as="span"
                  >
                    {r.severity}
                  </AnimatedDecodeLine>
                  {r.likelihood && (
                    <AnimatedDecodeLine
                      seq={seq}
                      kind={`risk-like:${i}`}
                      className="forge-risk-likelihood"
                      as="span"
                    >
                      {`${r.likelihood} likelihood`}
                    </AnimatedDecodeLine>
                  )}
                  <AnimatedFlowParagraph seq={seq} kind={`risk-text:${i}`} className="forge-risk-text" as="span">
                    {r.risk}
                  </AnimatedFlowParagraph>
                </div>
                {r.mitigation && (
                  <AnimatedFlowParagraph seq={seq} kind={`risk-mit:${i}`} className="forge-risk-mitigation">
                    {`Mitigation: ${r.mitigation}`}
                  </AnimatedFlowParagraph>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {assessment.recommendation?.trim() && (
        <section className="forge-market-section forge-market-recommendation">
          <AnimatedDecodeLine seq={seq} kind="rec-title" className="forge-market-subtitle" as="h4" header>
            Recommendation
          </AnimatedDecodeLine>
          <ForgeMarkdown animated animatePrefix={`${animatePrefix}:recommendation`}>
            {assessment.recommendation}
          </ForgeMarkdown>
        </section>
      )}

      {(assessment.sources?.length ?? 0) > 0 && (
        <section className="forge-market-section">
          <AnimatedDecodeLine seq={seq} kind="sources-title" className="forge-market-subtitle" as="h4" header>
            Sources
          </AnimatedDecodeLine>
          <ul className="forge-competitor-sources">
            {assessment.sources!.map((src, i) => (
              <li key={src}>
                <a href={src} target="_blank" rel="noreferrer">
                  <AnimatedFlowParagraph seq={seq} kind={`source:${i}`} as="span">
                    {src}
                  </AnimatedFlowParagraph>
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
