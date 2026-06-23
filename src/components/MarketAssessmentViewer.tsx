'use client';

import React from 'react';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import { ForgeDecodeText, ForgeFlowText } from '@/components/ForgeArwesText';
import {
  AnimatedDecodeLine,
  AnimatedFlowParagraph,
  createAnimateBlockSequence,
} from '@/lib/forgeAnimatedText';
import {
  MARKET_CORE_SUB_TABS,
  MARKET_SOURCES_SUB_TAB,
  MARKET_SUBTAB_SHORT_LABELS,
  defaultMarketSubTab,
  marketAssessmentHasContent,
  marketSubTabFromHash,
  marketSubTabHasContent,
  marketSubTabHash,
  sortRisksBySeverity,
  viabilityVerdictDef,
  type MarketSubTabId,
} from '@/lib/marketAssessment';
import { marketRisksToText } from '@/lib/marketRisksText';
import { EditableSectionHost, EditSectionButton } from '@/components/EditableSectionHost';
import type { EditableTarget } from '@/lib/editableSections';
import type { MarketAssessment } from '@/lib/businessTypes';

type MarketAssessmentViewerProps = {
  slug: string;
  assessment: MarketAssessment | undefined;
  animatePrefix?: string;
  marketInFlight?: boolean;
  onSaved?: () => void;
};

function useMarketSubTab(assessment: MarketAssessment | undefined) {
  const hasSources = marketSubTabHasContent(assessment, 'sources');
  const fallback = React.useMemo(
    () => defaultMarketSubTab(assessment),
    [assessment],
  );
  const [subTab, setSubTabState] = React.useState<MarketSubTabId>(() => {
    if (typeof window === 'undefined') return fallback;
    return marketSubTabFromHash(window.location.hash) ?? fallback;
  });

  React.useEffect(() => {
    const sync = () => {
      const fromHash = marketSubTabFromHash(window.location.hash);
      if (fromHash) setSubTabState(fromHash);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  React.useEffect(() => {
    const fromHash = typeof window !== 'undefined' ? marketSubTabFromHash(window.location.hash) : null;
    if (fromHash) return;
    setSubTabState((current) => {
      if (current === 'sources' && hasSources) return current;
      if (marketSubTabHasContent(assessment, current)) return current;
      return fallback;
    });
  }, [assessment, hasSources, fallback]);

  const setSubTab = React.useCallback((next: MarketSubTabId) => {
    setSubTabState(next);
    if (typeof window === 'undefined') return;
    const url = `${window.location.pathname}${window.location.search}#${marketSubTabHash(next)}`;
    window.history.replaceState(null, '', url);
  }, []);

  return [subTab, setSubTab] as const;
}

function MarketSubTabEmpty({
  subTab,
  marketInFlight,
}: {
  subTab: MarketSubTabId;
  marketInFlight?: boolean;
}) {
  const def =
    MARKET_CORE_SUB_TABS.find((t) => t.id === subTab) ??
    (subTab === 'sources' ? MARKET_SOURCES_SUB_TAB : null);
  const label = def?.label ?? 'This section';

  return (
    <ForgeFlowText
      as="p"
      className="forge-hint"
      layout="block"
      animateId={`market-section-empty:${subTab}`}
      playOnce
      delay={0.06}
    >
      {marketInFlight
        ? `${label} is still being drafted…`
        : `${label} has not been drafted yet. Run or complete the market assessment to fill it in.`}
    </ForgeFlowText>
  );
}

/**
 * Advisory viability read with section sub-tabs — verdict, sized market / demand /
 * timing, pros vs cons, risks, recommendation, and sources.
 */
export function MarketAssessmentViewer({
  slug,
  assessment,
  animatePrefix = 'market',
  marketInFlight,
  onSaved,
}: MarketAssessmentViewerProps) {
  const [editTarget, setEditTarget] = React.useState<EditableTarget | null>(null);

  if (!marketAssessmentHasContent(assessment) || !assessment) return null;

  const hasSources = marketSubTabHasContent(assessment, 'sources');
  const [subTab, setSubTab] = useMarketSubTab(assessment);
  const subTabs = hasSources
    ? [...MARKET_CORE_SUB_TABS, MARKET_SOURCES_SUB_TAB]
    : MARKET_CORE_SUB_TABS;
  const activeDef = subTabs.find((t) => t.id === subTab) ?? subTabs[0];
  const panelPrefix = `${animatePrefix}:${subTab}`;

  return (
    <div className="forge-market forge-market--tabbed">
      <nav className="forge-plan-subtabs" aria-label="Market assessment sections">
        {subTabs.map((t) => {
          const hasContent = marketSubTabHasContent(assessment, t.id);
          const isActive = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`forge-market-subpanel-${t.id}`}
              id={`forge-market-subtab-${t.id}`}
              className={[
                'forge-plan-subtab',
                isActive ? 'forge-plan-subtab--active' : '',
                !hasContent ? 'forge-plan-subtab--empty' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSubTab(t.id)}
            >
              <span className="forge-plan-subtab-short">{MARKET_SUBTAB_SHORT_LABELS[t.id]}</span>
              <span className="forge-plan-subtab-full">{t.label}</span>
            </button>
          );
        })}
      </nav>

      <section
        key={subTab}
        id={`forge-market-subpanel-${subTab}`}
        role="tabpanel"
        aria-labelledby={`forge-market-subtab-${subTab}`}
        className="forge-plan-subpanel"
      >
        <h3 className="forge-plan-subpanel-title">
          <ForgeDecodeText
            layout="inline"
            animateId={`market-section:${subTab}`}
            playOnce
            contentStyle={{ color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
          >
            {activeDef.label}
          </ForgeDecodeText>
        </h3>

        <MarketSubTabPanel
          subTab={subTab}
          assessment={assessment}
          animatePrefix={panelPrefix}
          marketInFlight={marketInFlight}
          onEdit={setEditTarget}
        />
      </section>

      <EditableSectionHost
        slug={slug}
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => onSaved?.()}
      />
    </div>
  );
}

function MarketSubTabPanel({
  subTab,
  assessment,
  animatePrefix,
  marketInFlight,
  onEdit,
}: {
  subTab: MarketSubTabId;
  assessment: MarketAssessment;
  animatePrefix: string;
  marketInFlight?: boolean;
  onEdit: (target: EditableTarget) => void;
}) {
  const seq = createAnimateBlockSequence(animatePrefix);
  const verdict = viabilityVerdictDef(assessment.verdict);
  const risks = sortRisksBySeverity(assessment.risks ?? []);
  const pros = assessment.pros ?? [];
  const cons = assessment.cons ?? [];

  if (subTab === 'verdict') {
    if (!marketSubTabHasContent(assessment, 'verdict')) {
      return <MarketSubTabEmpty subTab="verdict" marketInFlight={marketInFlight} />;
    }
    return (
      <>
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
              <div className="forge-plan-subpanel-head spread">
                <AnimatedFlowParagraph seq={seq} kind="verdict-headline" className="forge-verdict-headline">
                  {assessment.headline}
                </AnimatedFlowParagraph>
                <EditSectionButton
                  label="Edit headline"
                  onClick={() =>
                    onEdit({
                      path: ['market', 'headline'],
                      label: 'Verdict headline',
                      content: assessment.headline!.trim(),
                    })
                  }
                />
              </div>
            )}
            <AnimatedFlowParagraph seq={seq} kind="verdict-disclaimer" className="forge-verdict-disclaimer">
              Advisory only — pros, cons, and risks to inform your call. Agent Forge does not decide for you.
            </AnimatedFlowParagraph>
          </div>
        )}
      </>
    );
  }

  if (subTab === 'marketSize' || subTab === 'demandSignals' || subTab === 'timing') {
    const body = assessment[subTab]?.trim();
    if (!body) {
      return <MarketSubTabEmpty subTab={subTab} marketInFlight={marketInFlight} />;
    }
    const tabLabel = MARKET_CORE_SUB_TABS.find((t) => t.id === subTab)?.label ?? subTab;
    return (
      <>
        <div className="spread forge-plan-subpanel-head">
          <span />
          <EditSectionButton
            label="Edit section"
            onClick={() =>
              onEdit({
                path: ['market', subTab],
                label: tabLabel,
                content: body,
              })
            }
          />
        </div>
        <ForgeMarkdown className="forge-plan-section-body" animated animatePrefix={animatePrefix}>
          {body}
        </ForgeMarkdown>
      </>
    );
  }

  if (subTab === 'proscons') {
    if (!marketSubTabHasContent(assessment, 'proscons')) {
      return <MarketSubTabEmpty subTab="proscons" marketInFlight={marketInFlight} />;
    }
    return (
      <>
        <div className="spread forge-plan-subpanel-head">
          <span />
          <div className="forge-editor-actions">
            {pros.length > 0 && (
              <EditSectionButton
                label="Edit pros"
                onClick={() =>
                  onEdit({
                    path: ['market', 'pros'],
                    label: 'Pros',
                    content: pros.map((p) => `- ${p}`).join('\n'),
                  })
                }
              />
            )}
            {cons.length > 0 && (
              <EditSectionButton
                label="Edit cons"
                onClick={() =>
                  onEdit({
                    path: ['market', 'cons'],
                    label: 'Cons',
                    content: cons.map((c) => `- ${c}`).join('\n'),
                  })
                }
              />
            )}
          </div>
        </div>
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
      </>
    );
  }

  if (subTab === 'risks') {
    if (!marketSubTabHasContent(assessment, 'risks')) {
      return <MarketSubTabEmpty subTab="risks" marketInFlight={marketInFlight} />;
    }
    return (
      <>
        <div className="spread forge-plan-subpanel-head">
          <span />
          <EditSectionButton
            label="Edit risks"
            onClick={() =>
              onEdit({
                path: ['market', 'risks'],
                label: 'Market risks',
                content: marketRisksToText(risks),
              })
            }
          />
        </div>
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
      </>
    );
  }

  if (subTab === 'recommendation') {
    const body = assessment.recommendation?.trim();
    if (!body) {
      return <MarketSubTabEmpty subTab="recommendation" marketInFlight={marketInFlight} />;
    }
    return (
      <>
        <div className="spread forge-plan-subpanel-head">
          <span />
          <EditSectionButton
            label="Edit section"
            onClick={() =>
              onEdit({
                path: ['market', 'recommendation'],
                label: 'Recommendation',
                content: body,
              })
            }
          />
        </div>
        <ForgeMarkdown className="forge-plan-section-body" animated animatePrefix={animatePrefix}>
          {body}
        </ForgeMarkdown>
      </>
    );
    const sources = assessment.sources ?? [];
    if (sources.length === 0) {
      return <MarketSubTabEmpty subTab="sources" marketInFlight={marketInFlight} />;
    }
    return (
      <ul className="forge-competitor-sources">
        {sources.map((src, i) => (
          <li key={src}>
            <a href={src} target="_blank" rel="noreferrer">
              <AnimatedFlowParagraph seq={seq} kind={`source:${i}`} as="span">
                {src}
              </AnimatedFlowParagraph>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

export default MarketAssessmentViewer;
