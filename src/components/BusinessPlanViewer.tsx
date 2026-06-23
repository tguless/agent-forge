'use client';

import React from 'react';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import { ForgeDecodeText, ForgeFlowText } from '@/components/ForgeArwesText';
import { CompetitorAnalysisViewer } from '@/components/CompetitorAnalysisViewer';
import { competitorAnalysisHasContent } from '@/lib/competitorSections';
import {
  BUSINESS_PLAN_SECTIONS,
  PLAN_SUBTAB_SHORT_LABELS,
  businessPlanHasContent,
  defaultPlanSubTab,
  planSubTabFromHash,
  planSubTabHash,
  type PlanSubTabId,
} from '@/lib/businessPlanSections';
import { EditableSectionHost, EditSectionButton } from '@/components/EditableSectionHost';
import type { EditableTarget } from '@/lib/editableSections';
import type { BusinessPlanSections, CompetitorAnalysis } from '@/lib/businessTypes';

type BusinessPlanViewerProps = {
  slug: string;
  plan: BusinessPlanSections | undefined;
  competitorAnalysis?: CompetitorAnalysis;
  planInFlight?: boolean;
  onSectionSaved?: () => void;
};

function usePlanSubTab(plan: BusinessPlanSections | undefined, hasCompetitors: boolean) {
  const fallback = React.useMemo(
    () => defaultPlanSubTab(plan, hasCompetitors),
    [plan, hasCompetitors],
  );
  const [subTab, setSubTabState] = React.useState<PlanSubTabId>(() => {
    if (typeof window === 'undefined') return fallback;
    return planSubTabFromHash(window.location.hash) ?? fallback;
  });

  React.useEffect(() => {
    const sync = () => {
      const fromHash = planSubTabFromHash(window.location.hash);
      if (fromHash) setSubTabState(fromHash);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  React.useEffect(() => {
    const fromHash = typeof window !== 'undefined' ? planSubTabFromHash(window.location.hash) : null;
    if (fromHash) return;
    setSubTabState((current) => {
      if (current === 'competitors' && hasCompetitors) return current;
      if (current !== 'competitors') {
        const content = plan?.[current]?.trim();
        if (content) return current;
      }
      return fallback;
    });
  }, [plan, hasCompetitors, fallback]);

  const setSubTab = React.useCallback((next: PlanSubTabId) => {
    setSubTabState(next);
    if (typeof window === 'undefined') return;
    const url = `${window.location.pathname}${window.location.search}#${planSubTabHash(next)}`;
    window.history.replaceState(null, '', url);
  }, []);

  return [subTab, setSubTab] as const;
}

/** Section sub-tabs for the structured business plan (+ optional competitors). */
export function BusinessPlanViewer({
  slug,
  plan,
  competitorAnalysis,
  planInFlight,
  onSectionSaved,
}: BusinessPlanViewerProps) {
  const hasCompetitors = competitorAnalysisHasContent(competitorAnalysis);
  const [subTab, setSubTab] = usePlanSubTab(plan, hasCompetitors);
  const [editTarget, setEditTarget] = React.useState<EditableTarget | null>(null);

  if (!businessPlanHasContent(plan) && !hasCompetitors) return null;

  const activeSection = BUSINESS_PLAN_SECTIONS.find((s) => s.key === subTab);
  const activeContent = activeSection ? plan?.[activeSection.key]?.trim() : '';
  const filledCount = BUSINESS_PLAN_SECTIONS.filter((s) => plan?.[s.key]?.trim()).length;
  const pendingCount = BUSINESS_PLAN_SECTIONS.length - filledCount;

  return (
    <div className="forge-plan forge-plan--tabbed">
      <nav className="forge-plan-subtabs" aria-label="Business plan sections">
        {BUSINESS_PLAN_SECTIONS.map((s) => {
          const hasContent = !!plan?.[s.key]?.trim();
          const isActive = subTab === s.key;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`forge-plan-subpanel-${s.key}`}
              id={`forge-plan-subtab-${s.key}`}
              className={[
                'forge-plan-subtab',
                isActive ? 'forge-plan-subtab--active' : '',
                !hasContent ? 'forge-plan-subtab--empty' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSubTab(s.key)}
            >
              <span className="forge-plan-subtab-short">{PLAN_SUBTAB_SHORT_LABELS[s.key]}</span>
              <span className="forge-plan-subtab-full">{s.label}</span>
            </button>
          );
        })}
        {hasCompetitors && (
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'competitors'}
            aria-controls="forge-plan-subpanel-competitors"
            id="forge-plan-subtab-competitors"
            className={[
              'forge-plan-subtab',
              subTab === 'competitors' ? 'forge-plan-subtab--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setSubTab('competitors')}
          >
            <span className="forge-plan-subtab-short">Compete</span>
            <span className="forge-plan-subtab-full">Competitors</span>
          </button>
        )}
      </nav>

      {subTab === 'competitors' ? (
        <section
          key="competitors"
          id="forge-plan-subpanel-competitors"
          role="tabpanel"
          aria-labelledby="forge-plan-subtab-competitors"
          className="forge-plan-subpanel"
        >
          <CompetitorAnalysisViewer
            slug={slug}
            analysis={competitorAnalysis}
            animatePrefix="plan-competitors"
            onSaved={onSectionSaved}
          />
        </section>
      ) : activeSection ? (
        <section
          key={activeSection.key}
          id={`forge-plan-subpanel-${activeSection.key}`}
          role="tabpanel"
          aria-labelledby={`forge-plan-subtab-${activeSection.key}`}
          className="forge-plan-subpanel"
        >
          <div className="forge-plan-subpanel-head spread">
            <h3 className="forge-plan-subpanel-title">
              <ForgeDecodeText
                layout="inline"
                animateId={`plan-section:${activeSection.key}`}
                playOnce
                contentStyle={{ color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
              >
                {activeSection.label}
              </ForgeDecodeText>
            </h3>
            {activeContent && (
              <EditSectionButton
                label="Edit section"
                onClick={() =>
                  setEditTarget({
                    path: ['plan', activeSection.key],
                    label: activeSection.label,
                    content: activeContent,
                  })
                }
              />
            )}
          </div>
          {activeContent ? (
            <ForgeMarkdown
              className="forge-plan-section-body"
              animated
              animatePrefix={`plan-section:${activeSection.key}`}
            >
              {activeContent}
            </ForgeMarkdown>
          ) : (
            <ForgeFlowText
              as="p"
              className="forge-hint"
              layout="block"
              animateId={`plan-section-empty:${activeSection.key}`}
              playOnce
              delay={0.06}
            >
              {planInFlight
                ? 'This section is still being drafted…'
                : 'This section has not been drafted yet. Generate or complete the business plan to fill it in.'}
            </ForgeFlowText>
          )}
        </section>
      ) : null}

      {pendingCount > 0 && planInFlight && subTab !== 'competitors' && (
        <p className="forge-hint forge-plan-pending">
          {pendingCount} section{pendingCount === 1 ? '' : 's'} still being drafted…
        </p>
      )}

      <EditableSectionHost
        slug={slug}
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => onSectionSaved?.()}
      />
    </div>
  );
}

export default BusinessPlanViewer;
