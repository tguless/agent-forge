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
}: {
  title?: string;
  actions?: React.ReactNode;
}) {
  if (!title && !actions) return null;
  return (
    <div className="forge-blueprint-tab-head">
      {title ? <h2 className="forge-blueprint-tab-title">{title}</h2> : null}
      {actions ? <div className="forge-blueprint-tab-actions">{actions}</div> : null}
    </div>
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
              <h3 className="forge-blueprint-panel-label">Elevator pitch</h3>
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
              <h3 className="forge-blueprint-panel-label">Profile</h3>
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
              <p className="forge-hint">Consultant is still filling in the overview.</p>
            )}
        </ForgeBlueprintTabPanel>

        <ForgeBlueprintTabPanel id="plan" active={tab}>
          <TabPanelHead
            title="Business plan"
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
            <p className="forge-hint">
              Eight-section operator plan — switch sections with the tabs below.
            </p>
          )}

          {!planComplete && !hasBusinessPlan && !planInFlight && (
            <p className="forge-hint">
              No business plan yet. Generate one from the business description and profile — eight section tabs plus competitors when available.
            </p>
          )}

          {!planComplete && hasBusinessPlan && !planInFlight && (
            <p className="forge-hint">Plan is incomplete — generate the remaining sections.</p>
          )}

          {detail.consultInFlight && !planInFlight && !planComplete && (
            <p className="forge-hint">
              Blueprint consult is running; you can generate the plan once it finishes.
            </p>
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
                plan={business.profile.businessPlan}
                competitorAnalysis={business.profile.competitorAnalysis}
                planInFlight={planInFlight}
              />
            </div>
          )}
        </ForgeBlueprintTabPanel>

        <ForgeBlueprintTabPanel id="market" active={tab}>
          <TabPanelHead
            title="Market assessment"
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
            <p className="forge-hint">
              No market assessment yet. Run a candid viability read — sized market (TAM/SAM/SOM),
              demand signals, timing, risks, and an advisory go/no-go verdict. It lays out the pros,
              cons, and risks; the decision stays yours.
            </p>
          )}

          {detail.consultInFlight && !marketStreamHere && !hasMarketAssessment && (
            <p className="forge-hint">
              Blueprint consult is running; the market assessment is part of it.
            </p>
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
              <MarketAssessmentViewer assessment={business.profile.marketAssessment} />
            </div>
          )}
        </ForgeBlueprintTabPanel>

        <ForgeBlueprintTabPanel id="stack" active={tab}>
          <TabPanelHead title="Software stack" />
          <p className="forge-hint">
            One default per category (★). Click an alternative to override what agents get access to.
          </p>
          <div className="forge-stack-grid">
            {appStack.map((group) => (
              <div key={group.appTypeKey}>
                <div className="forge-stack-type">{group.appTypeLabel}</div>
                <div className="forge-stack-options">
                  {group.options.map((opt) => {
                    const selected = opt.appId === group.selectedAppId;
                    return (
                      <button
                        key={opt.appId}
                        type="button"
                        className={`forge-stack-option${selected ? ' forge-stack-option--selected' : ''}`}
                        onClick={() => !selected && void selectApp(opt.appId)}
                        title={opt.rationale}
                      >
                        {opt.isAgentDefault ? '★ ' : ''}
                        {opt.app.name}
                        <span className="forge-stack-kind">{opt.app.kind}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {appStack.length === 0 && <p className="forge-hint">No apps recommended yet.</p>}
          </div>
        </ForgeBlueprintTabPanel>

        <ForgeBlueprintTabPanel id="team" active={tab}>
          <TabPanelHead
            title="Team"
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
              <h3 className="forge-blueprint-panel-label">
                Forged agents
                <span className="forge-collapse-count">{sortedAgents.length}</span>
              </h3>
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
              <h3 className="forge-blueprint-panel-label forge-blueprint-panel-label--spaced">
                Suggested roles
                <span className="forge-collapse-count">{suggestedRoles.length}</span>
              </h3>
              <div className="forge-role-list">
                {suggestedRoles.map((role) => (
                  <BlueprintRoleItem
                    key={role.id}
                    role={role}
                    forgeBusy={forgeBusy}
                    onForge={(roleId) => void forge(roleId)}
                  />
                ))}
              </div>
            </>
          )}

          {suggestedRoles.length === 0 && sortedAgents.length === 0 && (
            <p className="forge-hint">No roles suggested yet.</p>
          )}
          {suggestedRoles.length === 0 && sortedAgents.length > 0 && (
            <p className="forge-hint forge-blueprint-team-note">All suggested roles have been forged.</p>
          )}
        </ForgeBlueprintTabPanel>
      </div>
          </div>
        </div>
      </div>
    </div>
  );
}
