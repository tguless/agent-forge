'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ForgeInteractiveHudBox } from '@/components/ForgeInteractiveHudBox';
import { BusinessPlanViewer } from '@/components/BusinessPlanViewer';
import { MarketAssessmentViewer } from '@/components/MarketAssessmentViewer';
import { competitorAnalysisHasContent } from '@/lib/competitorSections';
import { TurnTimeline, useBusinessPlanStream } from '@/components/TurnTimeline';
import { ForgeQueueProgress, type ForgeQueueSnapshot } from '@/components/ForgeQueueProgress';
import { ForgedAgentRolePair } from '@/components/ForgedAgentRolePair';
import { BlueprintRoleItem } from '@/components/BlueprintRoleItem';
import type { BusinessAgentSummary } from '@/lib/businessStore';
import { BusinessPlaque } from '@/components/BusinessPlaque';
import { ForgeTopNav } from '@/components/ForgeTopNav';
import { EditableSectionHost, EditSectionButton } from '@/components/EditableSectionHost';
import type { EditableTarget } from '@/lib/editableSections';
import { ForgeDecodeText, ForgeFlowText } from '@/components/ForgeArwesText';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import { useTextFillDelay } from '@/hooks/useTextFillDelay';
import {
  ForgeBlueprintTabBar,
  ForgeBlueprintTabPanel,
  useBlueprintTab,
} from '@/components/ForgeBlueprintTabs';
import type {
  Business,
  BusinessApp,
  BusinessRole,
  Capacity,
} from '@/lib/businessTypes';

type StackGroup = {
  appTypeKey: string;
  appTypeLabel: string;
  selectedAppId: number | null;
  options: BusinessApp[];
};

type BusinessAgent = BusinessAgentSummary;

type Detail = {
  business: Business;
  consultInFlight: boolean;
  planInFlight: boolean;
  forgeQueueActive: boolean;
  forgeQueue: ForgeQueueSnapshot | null;
  hasBusinessPlan: boolean;
  planComplete: boolean;
  hasMarketAssessment: boolean;
  marketComplete: boolean;
  roles: BusinessRole[];
  appStack: StackGroup[];
  agents: BusinessAgent[];
  capacities: Capacity[];
};

function TabPanelHead({
  title,
  actions,
  titleAnimateId,
  titleDelay,
}: {
  title?: string;
  actions?: React.ReactNode;
  titleAnimateId?: string;
  titleDelay?: number;
}) {
  if (!title && !actions) return null;
  return (
    <div className="forge-blueprint-tab-head">
      {title ? (
        <h2 className="forge-blueprint-tab-title">
          <ForgeDecodeText
            layout="inline"
            animateId={titleAnimateId ?? title}
            playOnce
            delay={titleDelay}
            contentStyle={{ color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
          >
            {title}
          </ForgeDecodeText>
        </h2>
      ) : null}
      {actions ? <div className="forge-blueprint-tab-actions">{actions}</div> : null}
    </div>
  );
}

function BlueprintPanelLabel({
  children,
  animateId,
  delay,
  className = 'forge-blueprint-panel-label',
  count,
}: {
  children: string;
  animateId: string;
  delay?: number;
  className?: string;
  count?: number;
}) {
  return (
    <h3 className={className}>
      <ForgeDecodeText
        layout="inline"
        animateId={animateId}
        playOnce
        delay={delay}
        contentStyle={{ color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
      >
        {children}
      </ForgeDecodeText>
      {typeof count === 'number' ? <span className="forge-collapse-count">{count}</span> : null}
    </h3>
  );
}

function BlueprintFlowParagraph({
  children,
  animateId,
  delay,
  className = 'forge-hint',
}: {
  children: string;
  animateId: string;
  delay?: number;
  className?: string;
}) {
  return (
    <ForgeFlowText
      as="p"
      className={className}
      layout="block"
      animateId={animateId}
      playOnce
      delay={delay}
    >
      {children}
    </ForgeFlowText>
  );
}

export default function BlueprintPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { slug } = params;
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [forgeError, setForgeError] = React.useState<string | null>(null);
  const [planBusy, setPlanBusy] = React.useState(false);
  const [planError, setPlanError] = React.useState<string | null>(null);
  const [marketBusy, setMarketBusy] = React.useState(false);
  const [marketError, setMarketError] = React.useState<string | null>(null);
  // Which research run owns the shared (business-plan scope) live stream.
  const [activeStream, setActiveStream] = React.useState<'plan' | 'market' | null>(null);

  const planStreamActive = detail?.planInFlight ?? false;
  const { turns: planTurns, done: planDone } = useBusinessPlanStream(slug, planStreamActive);
  const fillDelay = useTextFillDelay();
  const [tab, setTab] = useBlueprintTab('overview');
  const [blueprintEdit, setBlueprintEdit] = React.useState<EditableTarget | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/businesses/${slug}`, { cache: 'no-store' });
    if (!res.ok) return true;
    const json = (await res.json()) as Detail;
    setDetail(json);
    const queueActive = json.forgeQueueActive || !!json.forgeQueue?.active;
    const agentsSettling = json.agents.some((a) => a.status === 'queued' || a.status === 'generating');
    return !json.consultInFlight && !json.planInFlight && !queueActive && !agentsSettling;
  }, [slug]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    void load().then((done) => {
      if (!done) timer = setInterval(async () => {
        if (await load()) timer && clearInterval(timer);
      }, 3000);
    });
    return () => timer && clearInterval(timer);
  }, [load]);

  React.useEffect(() => {
    if (planDone) void load();
  }, [planDone, load]);

  const selectApp = async (appId: number) => {
    await fetch(`/api/businesses/${slug}/apps`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appId }),
    });
    await load();
  };

  const forge = async (roleId?: number) => {
    setForgeError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/businesses/${slug}/forge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(roleId != null ? { roleId } : {}),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setForgeError(json.error ?? `Server error ${res.status}`);
        return;
      }
      setTab('team');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const requestPlan = async () => {
    setPlanBusy(true);
    setPlanError(null);
    try {
      const res = await fetch(`/api/businesses/${slug}/plan`, { method: 'POST' });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPlanError(json.error ?? `Server error ${res.status}`);
        return;
      }
      setActiveStream('plan');
      setTab('plan');
      await load();
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to start plan generation');
    } finally {
      setPlanBusy(false);
    }
  };

  const requestMarket = async () => {
    setMarketBusy(true);
    setMarketError(null);
    try {
      const res = await fetch(`/api/businesses/${slug}/market`, { method: 'POST' });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMarketError(json.error ?? `Server error ${res.status}`);
        return;
      }
      setActiveStream('market');
      setTab('market');
      await load();
    } catch (err) {
      setMarketError(err instanceof Error ? err.message : 'Failed to start market assessment');
    } finally {
      setMarketBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    const label = detail.business.name || slug;
    if (
      !window.confirm(
        `Delete "${label}"?\n\nThis removes the blueprint, business plan, market assessment, forged agents, and generated images. This cannot be undone.`,
      )
    ) {
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
      const res = await fetch(`/api/businesses/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { error?: string };
      if (res.status === 403) {
        window.alert('Incorrect deletion password.');
        setDeleting(false);
        return;
      }
      if (!res.ok) {
        window.alert(json.error ?? 'Could not delete this business.');
        setDeleting(false);
        return;
      }
      router.push('/business');
      router.refresh();
    } catch {
      window.alert('Could not delete this business. Try again.');
      setDeleting(false);
    }
  };

  if (!detail) return <div className="ops-font-scope forge-empty">Loading blueprint…</div>;

  const { business, roles, appStack, agents, planInFlight, hasBusinessPlan, planComplete, hasMarketAssessment, marketComplete, forgeQueueActive, forgeQueue } = detail;
  // The plan + market runs share the business-plan SSE scope; route the live
  // timeline to whichever section started it.
  const planStreamHere = planInFlight && activeStream !== 'market';
  const marketStreamHere = planInFlight && activeStream === 'market';
  const suggestedRoles = roles.filter((r) => r.status === 'suggested');
  const forgeBusy = busy || forgeQueueActive;
  const forgePhaseBySlug = new Map<string, 'running' | 'pending'>();
  if (forgeQueue?.current?.agentSlug) {
    forgePhaseBySlug.set(forgeQueue.current.agentSlug, 'running');
  }
  for (const item of forgeQueue?.items ?? []) {
    if (item.status === 'pending' && !forgePhaseBySlug.has(item.agentSlug)) {
      forgePhaseBySlug.set(item.agentSlug, 'pending');
    }
  }
  const agentRank = (status: string) => {
    if (status === 'generating' || status === 'queued') return 0;
    if (status === 'complete') return 1;
    return 2;
  };
  const sortedAgents = [...agents].sort((a, b) => {
    const diff = agentRank(a.status) - agentRank(b.status);
    return diff !== 0 ? diff : b.createdAt - a.createdAt;
  });
  const roleByAgentSlug = new Map(
    roles.filter((r): r is BusinessRole & { agentSlug: string } => !!r.agentSlug).map((r) => [r.agentSlug, r]),
  );

  const industryTag = business.profile.industry ?? 'Business blueprint';
  const d = (key: string, offset: number) => fillDelay(`${slug}:${key}`, offset);

  return (
    <div className="ops-detail-page forge-blueprint-page">
      <div className="ops-detail-shell">
        <span className="ops-detail-corner ops-detail-corner-tl" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-tr" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-bl" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-br" aria-hidden />

        <div className="ops-detail-inner">
          <ForgeTopNav
            variant="detail"
            trailing={
              !detail.business.isPlaceholder ? (
                <button
                  type="button"
                  className="ops-detail-delete"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  aria-busy={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete business'}
                </button>
              ) : null
            }
          />

          <header className="ops-detail-header forge-blueprint-header">
            <div className="ops-detail-brand">
              <ForgeDecodeText
                className="forge-wordmark"
                layout="inline"
                contentStyle={{ color: 'inherit', fontFamily: 'inherit' }}
                animateId={`${slug}:wordmark`}
                playOnce
                delay={d('wordmark', 0)}
              >
                AGENT<span>FORGE</span>
              </ForgeDecodeText>
              <ForgeDecodeText
                as="div"
                className="ops-detail-brand-tag"
                layout="inline"
                animateId={`${slug}:brand-tag`}
                playOnce
                delay={d('brand-tag', 0.08)}
                contentStyle={{ color: 'inherit', fontFamily: 'inherit' }}
              >
                Business blueprint
              </ForgeDecodeText>
            </div>
            <div className="ops-detail-title-block">
              <h1 className="ops-detail-title">
                <ForgeDecodeText
                  layout="block"
                  animateId={`${slug}:title:${business.name}`}
                  playOnce
                  delay={d('title', 0.12)}
                  contentStyle={{ color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
                >
                  {business.name}
                </ForgeDecodeText>
              </h1>
              <p className="ops-detail-subtitle">
                <ForgeDecodeText
                  layout="inline"
                  animateId={`${slug}:subtitle:${industryTag}`}
                  playOnce
                  delay={d('subtitle', 0.18)}
                  contentStyle={{ color: 'inherit', fontFamily: 'inherit' }}
                >
                  {industryTag}
                </ForgeDecodeText>
              </p>
            </div>
            <BusinessPlaque business={business} disabled={detail.consultInFlight} />
          </header>

          <div className="forge-blueprint-body">
            <ForgeFlowText
              as="p"
              className="forge-hint forge-blueprint-lead"
              layout="block"
              animateId={`${slug}:lead:${business.description}`}
              playOnce
              delay={d('lead', 0.24)}
            >
              {business.description}
            </ForgeFlowText>

      {detail.consultInFlight && (
        <div className="forge-status-line forge-blueprint-status">
          <span className="forge-spinner" aria-hidden /> Consultant is still building this blueprint…
        </div>
      )}
      {business.status === 'error' && (
        <p className="forge-error forge-blueprint-status">Consulting failed: {business.error}</p>
      )}

      <ForgeBlueprintTabBar
        active={tab}
        onSelect={setTab}
        roleCount={roles.length}
        agentCount={agents.length}
        planActive={planStreamHere}
        marketActive={marketStreamHere}
        teamActive={forgeQueueActive}
      />

      <div className="forge-blueprint-tab-panels">
        <ForgeBlueprintTabPanel id="overview" active={tab}>
          {business.profile.elevatorPitch && (
            <ForgeInteractiveHudBox variant="rect" className="forge-blueprint-panel">
              <div className="forge-plan-subpanel-head spread">
                <BlueprintPanelLabel animateId={`${slug}:overview:elevator-label`} delay={d('overview-elevator-label', 0.04)}>
                  Elevator pitch
                </BlueprintPanelLabel>
                <EditSectionButton
                  label="Edit"
                  onClick={() =>
                    setBlueprintEdit({
                      path: ['profile', 'elevatorPitch'],
                      label: 'Elevator pitch',
                      content: business.profile.elevatorPitch!.trim(),
                    })
                  }
                />
              </div>
              <ForgeFlowText
                as="p"
                className="forge-elevator-pitch"
                layout="block"
                animateId={`${slug}:elevator:${business.profile.elevatorPitch}`}
                playOnce
                delay={d('elevator-body', 0.42)}
              >
                {business.profile.elevatorPitch}
              </ForgeFlowText>
            </ForgeInteractiveHudBox>
          )}

          {(business.profile.industry || business.profile.summary) && (
            <ForgeInteractiveHudBox variant="rect" className="forge-blueprint-panel">
              <div className="forge-plan-subpanel-head spread">
                <BlueprintPanelLabel animateId={`${slug}:overview:profile-label`} delay={d('overview-profile-label', 0.04)}>
                  Profile
                </BlueprintPanelLabel>
                <div className="forge-editor-actions">
                  {business.profile.industry && (
                    <EditSectionButton
                      label="Edit industry"
                      onClick={() =>
                        setBlueprintEdit({
                          path: ['profile', 'industry'],
                          label: 'Industry',
                          content: business.profile.industry!.trim(),
                        })
                      }
                    />
                  )}
                  {business.profile.businessModel && (
                    <EditSectionButton
                      label="Edit model"
                      onClick={() =>
                        setBlueprintEdit({
                          path: ['profile', 'businessModel'],
                          label: 'Business model',
                          content: business.profile.businessModel!.trim(),
                        })
                      }
                    />
                  )}
                  {business.profile.summary && (
                    <EditSectionButton
                      label="Edit summary"
                      onClick={() =>
                        setBlueprintEdit({
                          path: ['profile', 'summary'],
                          label: 'Summary',
                          content: business.profile.summary!.trim(),
                        })
                      }
                    />
                  )}
                  {!!business.profile.valueChain?.length && (
                    <EditSectionButton
                      label="Edit value chain"
                      onClick={() =>
                        setBlueprintEdit({
                          path: ['profile', 'valueChain'],
                          label: 'Value chain',
                          content: business.profile.valueChain!.join('\n'),
                        })
                      }
                    />
                  )}
                </div>
              </div>
              {business.profile.industry && (
                <BlueprintFlowParagraph
                  animateId={`${slug}:profile-industry:${business.profile.industry}`}
                  delay={d('profile-industry', 0.46)}
                >
                  {`Industry: ${business.profile.industry}`}
                </BlueprintFlowParagraph>
              )}
              {business.profile.businessModel && (
                <BlueprintFlowParagraph
                  animateId={`${slug}:profile-model:${business.profile.businessModel}`}
                  delay={d('profile-model', 0.5)}
                >
                  {`Model: ${business.profile.businessModel}`}
                </BlueprintFlowParagraph>
              )}
              {business.profile.summary && (
                <BlueprintFlowParagraph
                  animateId={`${slug}:profile-summary:${business.profile.summary}`}
                  delay={d('profile-summary', 0.54)}
                >
                  {business.profile.summary}
                </BlueprintFlowParagraph>
              )}
              {!!business.profile.valueChain?.length && (
                <BlueprintFlowParagraph
                  animateId={`${slug}:profile-chain:${business.profile.valueChain.join(' → ')}`}
                  delay={d('profile-chain', 0.58)}
                >
                  {`Value chain: ${business.profile.valueChain.join(' → ')}`}
                </BlueprintFlowParagraph>
              )}
            </ForgeInteractiveHudBox>
          )}

          {!business.profile.elevatorPitch &&
            !business.profile.industry &&
            !business.profile.summary && (
              <BlueprintFlowParagraph
                animateId={`${slug}:overview:empty`}
                delay={d('overview-empty', 0.06)}
              >
                Consultant is still filling in the overview.
              </BlueprintFlowParagraph>
            )}
        </ForgeBlueprintTabPanel>

        <ForgeBlueprintTabPanel id="plan" active={tab}>
          <TabPanelHead
            title="Business plan"
            titleAnimateId={`${slug}:plan:tab-title`}
            titleDelay={d('plan-tab-title', 0.02)}
            actions={
              !planComplete && !planInFlight && !detail.consultInFlight ? (
                <button
                  type="button"
                  className="forge-cta forge-cta--sm"
                  disabled={planBusy || detail.consultInFlight || planInFlight}
                  onClick={() => void requestPlan()}
                >
                  {planBusy ? 'Starting…' : hasBusinessPlan ? 'Complete business plan' : 'Generate business plan'}
                </button>
              ) : null
            }
          />

          {planComplete && (
            <BlueprintFlowParagraph animateId={`${slug}:plan:complete-hint`} delay={d('plan-complete-hint', 0.08)}>
              Eight-section operator plan — switch sections with the tabs below.
            </BlueprintFlowParagraph>
          )}

          {!planComplete && !hasBusinessPlan && !planInFlight && (
            <BlueprintFlowParagraph animateId={`${slug}:plan:empty-hint`} delay={d('plan-empty-hint', 0.08)}>
              No business plan yet. Generate one from the business description and profile — eight section tabs plus competitors when available.
            </BlueprintFlowParagraph>
          )}

          {!planComplete && hasBusinessPlan && !planInFlight && (
            <BlueprintFlowParagraph animateId={`${slug}:plan:incomplete-hint`} delay={d('plan-incomplete-hint', 0.08)}>
              Plan is incomplete — generate the remaining sections.
            </BlueprintFlowParagraph>
          )}

          {detail.consultInFlight && !planInFlight && !planComplete && (
            <BlueprintFlowParagraph animateId={`${slug}:plan:consult-hint`} delay={d('plan-consult-hint', 0.08)}>
              Blueprint consult is running; you can generate the plan once it finishes.
            </BlueprintFlowParagraph>
          )}

          {planStreamHere && (
            <>
              <div className="forge-status-line">
                <span className="forge-spinner" aria-hidden /> Drafting business plan sections…
              </div>
              <div className="forge-blueprint-tab-block">
                <TurnTimeline turns={planTurns} />
              </div>
            </>
          )}

          {planError && <p className="forge-error forge-blueprint-tab-error">{planError}</p>}

          {(hasBusinessPlan || competitorAnalysisHasContent(business.profile.competitorAnalysis)) && (
            <div className={planInFlight ? 'forge-blueprint-tab-block' : undefined}>
              <BusinessPlanViewer
                slug={slug}
                plan={business.profile.businessPlan}
                competitorAnalysis={business.profile.competitorAnalysis}
                planInFlight={planInFlight}
                onSectionSaved={() => void load()}
              />
            </div>
          )}
        </ForgeBlueprintTabPanel>

        <ForgeBlueprintTabPanel id="market" active={tab}>
          <TabPanelHead
            title="Market assessment"
            titleAnimateId={`${slug}:market:tab-title`}
            titleDelay={d('market-tab-title', 0.02)}
            actions={
              !marketComplete && !marketStreamHere && !detail.consultInFlight && !planStreamHere ? (
                <button
                  type="button"
                  className="forge-cta forge-cta--sm"
                  disabled={marketBusy || detail.consultInFlight || planInFlight}
                  onClick={() => void requestMarket()}
                >
                  {marketBusy
                    ? 'Starting…'
                    : hasMarketAssessment
                      ? 'Complete market assessment'
                      : 'Assess market & viability'}
                </button>
              ) : null
            }
          />

          {!hasMarketAssessment && !marketStreamHere && (
            <BlueprintFlowParagraph animateId={`${slug}:market:empty-hint`} delay={d('market-empty-hint', 0.08)}>
              No market assessment yet. Run a candid viability read — sized market (TAM/SAM/SOM), demand signals, timing, risks, and an advisory go/no-go verdict. It lays out the pros, cons, and risks; the decision stays yours.
            </BlueprintFlowParagraph>
          )}

          {detail.consultInFlight && !marketStreamHere && !hasMarketAssessment && (
            <BlueprintFlowParagraph animateId={`${slug}:market:consult-hint`} delay={d('market-consult-hint', 0.08)}>
              Blueprint consult is running; the market assessment is part of it.
            </BlueprintFlowParagraph>
          )}

          {marketStreamHere && (
            <>
              <div className="forge-status-line">
                <span className="forge-spinner" aria-hidden /> Researching the market & drafting the verdict…
              </div>
              <div className="forge-blueprint-tab-block">
                <TurnTimeline turns={planTurns} />
              </div>
            </>
          )}

          {marketError && <p className="forge-error forge-blueprint-tab-error">{marketError}</p>}

          {hasMarketAssessment && (
            <div className={marketStreamHere ? 'forge-blueprint-tab-block' : undefined}>
              <MarketAssessmentViewer
                slug={slug}
                assessment={business.profile.marketAssessment}
                animatePrefix={`${slug}:market`}
                marketInFlight={marketStreamHere}
                onSaved={() => void load()}
              />
            </div>
          )}
        </ForgeBlueprintTabPanel>

        <ForgeBlueprintTabPanel id="stack" active={tab}>
          <TabPanelHead
            title="Software stack"
            titleAnimateId={`${slug}:stack:tab-title`}
            titleDelay={d('stack-tab-title', 0.02)}
          />
          <BlueprintFlowParagraph animateId={`${slug}:stack:intro`} delay={d('stack-intro', 0.08)}>
            One default per category (★). Click an alternative to override what agents get access to.
          </BlueprintFlowParagraph>
          <div className="forge-stack-grid">
            {appStack.map((group, groupIndex) => (
              <div key={group.appTypeKey}>
                <ForgeDecodeText
                  as="div"
                  className="forge-stack-type"
                  layout="block"
                  animateId={`${slug}:stack:type:${group.appTypeKey}`}
                  playOnce
                  delay={d(`stack-type-${group.appTypeKey}`, 0.12 + groupIndex * 0.05)}
                  contentStyle={{ color: 'inherit', fontFamily: 'inherit' }}
                >
                  {group.appTypeLabel}
                </ForgeDecodeText>
                <div className="forge-stack-options">
                  {group.options.map((opt) => {
                    const selected = opt.appId === group.selectedAppId;
                    return (
                      <div key={opt.appId} className="forge-stack-option-wrap">
                        <button
                          type="button"
                          className={`forge-stack-option${selected ? ' forge-stack-option--selected' : ''}`}
                          onClick={() => !selected && void selectApp(opt.appId)}
                        >
                          {opt.isAgentDefault ? '★ ' : ''}
                          {opt.app.name}
                          <span className="forge-stack-kind">{opt.app.kind}</span>
                        </button>
                        {opt.rationale?.trim() && (
                          <div className="forge-stack-rationale-row spread">
                            <span className="forge-hint forge-stack-rationale" title={opt.rationale}>
                              {opt.rationale.length > 120 ? `${opt.rationale.slice(0, 120)}…` : opt.rationale}
                            </span>
                            <EditSectionButton
                              label="Edit rationale"
                              onClick={() =>
                                setBlueprintEdit({
                                  path: ['stack', String(opt.id), 'rationale'],
                                  label: `${opt.app.name} — Recommendation rationale`,
                                  content: opt.rationale.trim(),
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {appStack.length === 0 && (
              <BlueprintFlowParagraph animateId={`${slug}:stack:empty`} delay={d('stack-empty', 0.1)}>
                No apps recommended yet.
              </BlueprintFlowParagraph>
            )}
          </div>
        </ForgeBlueprintTabPanel>

        <ForgeBlueprintTabPanel id="team" active={tab}>
          <TabPanelHead
            title="Team"
            titleAnimateId={`${slug}:team:tab-title`}
            titleDelay={d('team-tab-title', 0.02)}
            actions={
              suggestedRoles.length > 0 ? (
                <button
                  type="button"
                  className="forge-cta forge-cta--sm"
                  disabled={forgeBusy}
                  onClick={() => void forge()}
                >
                  {forgeQueueActive ? 'Forging…' : busy ? 'Starting…' : `⚡ Forge all (${suggestedRoles.length})`}
                </button>
              ) : null
            }
          />

          {forgeQueue?.active ? <ForgeQueueProgress queue={forgeQueue} /> : null}
          {forgeError ? <p className="forge-error forge-blueprint-tab-error">{forgeError}</p> : null}

          {sortedAgents.length > 0 && (
            <>
              <BlueprintPanelLabel
                animateId={`${slug}:team:forged-label`}
                delay={d('team-forged-label', 0.08)}
                count={sortedAgents.length}
              >
                Forged agents
              </BlueprintPanelLabel>
              <div className="forge-forged-agent-rows">
                {sortedAgents.map((a) => (
                  <ForgedAgentRolePair
                    key={a.slug}
                    agent={a}
                    role={roleByAgentSlug.get(a.slug)}
                    businessName={business.name}
                    forgePhase={forgePhaseBySlug.get(a.slug)}
                  />
                ))}
              </div>
            </>
          )}

          {suggestedRoles.length > 0 && (
            <>
              <BlueprintPanelLabel
                animateId={`${slug}:team:suggested-label`}
                delay={d('team-suggested-label', 0.12)}
                className="forge-blueprint-panel-label forge-blueprint-panel-label--spaced"
                count={suggestedRoles.length}
              >
                Suggested roles
              </BlueprintPanelLabel>
              <div className="forge-role-list">
                {suggestedRoles.map((role) => (
                  <BlueprintRoleItem
                    key={role.id}
                    slug={slug}
                    role={role}
                    forgeBusy={forgeBusy}
                    onForge={(roleId) => void forge(roleId)}
                    onSaved={() => void load()}
                  />
                ))}
              </div>
            </>
          )}

          {suggestedRoles.length === 0 && sortedAgents.length === 0 && (
            <BlueprintFlowParagraph animateId={`${slug}:team:empty`} delay={d('team-empty', 0.1)}>
              No roles suggested yet.
            </BlueprintFlowParagraph>
          )}
          {suggestedRoles.length === 0 && sortedAgents.length > 0 && (
            <BlueprintFlowParagraph
              animateId={`${slug}:team:all-forged`}
              delay={d('team-all-forged', 0.14)}
              className="forge-hint forge-blueprint-team-note"
            >
              All suggested roles have been forged.
            </BlueprintFlowParagraph>
          )}
        </ForgeBlueprintTabPanel>
      </div>
          </div>
        </div>
      </div>

      <EditableSectionHost
        slug={slug}
        target={blueprintEdit}
        onClose={() => setBlueprintEdit(null)}
        onSaved={() => void load()}
      />
    </div>
  );
}
