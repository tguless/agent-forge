'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ForgeInteractiveHudBox } from '@/components/ForgeInteractiveHudBox';
import { BusinessPlanViewer } from '@/components/BusinessPlanViewer';
import { CompetitorAnalysisViewer } from '@/components/CompetitorAnalysisViewer';
import { MarketAssessmentViewer } from '@/components/MarketAssessmentViewer';
import { competitorAnalysisHasContent } from '@/lib/competitorSections';
import { marketAssessmentHasContent } from '@/lib/marketAssessment';
import { TurnTimeline, useBusinessPlanStream } from '@/components/TurnTimeline';
import { ForgeQueueProgress, type ForgeQueueSnapshot } from '@/components/ForgeQueueProgress';
import { ForgedAgentLicense } from '@/components/ForgedAgentLicense';
import type { BusinessAgentSummary } from '@/lib/businessStore';
import { BusinessPlaque } from '@/components/BusinessPlaque';
import { ForgeTopNav } from '@/components/ForgeTopNav';
import { ForgeDecodeText, ForgeFlowText } from '@/components/ForgeArwesText';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import { useTextFillDelay } from '@/hooks/useTextFillDelay';
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

const BLUEPRINT_SECTION_STAGGER_S = 0.18;

function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  actions,
  children,
  animateId,
  delay = 0,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  animateId?: string;
  delay?: number;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <ForgeInteractiveHudBox
      variant="rect"
      className="forge-blueprint-section"
      accent="var(--ops-detail-green-bright, #8ee85a)"
    >
      <div className="forge-collapse-head">
        <button
          type="button"
          className="forge-collapse-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="forge-collapse-chevron" aria-hidden>
            {open ? '▾' : '▸'}
          </span>
          <span className="forge-collapse-title">
            <ForgeDecodeText
              animateId={animateId ?? `blueprint:section:${title}`}
              playOnce
              delay={delay}
              layout="inline"
              contentStyle={{ color: 'inherit' }}
            >
              {title}
            </ForgeDecodeText>
          </span>
          {typeof count === 'number' && <span className="forge-collapse-count">{count}</span>}
        </button>
        {actions && <div className="forge-collapse-actions">{actions}</div>}
      </div>
      {open && <div className="forge-collapse-body">{children}</div>}
    </ForgeInteractiveHudBox>
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

  const industryTag = business.profile.industry ?? 'Business blueprint';
  const d = (key: string, offset: number) => fillDelay(`${slug}:${key}`, offset);
  let sectionIdx = 0;
  const nextSectionDelay = () => {
    const delay = d(`section-${sectionIdx}`, 0.34 + sectionIdx * BLUEPRINT_SECTION_STAGGER_S);
    sectionIdx += 1;
    return delay;
  };

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

      <div className="forge-blueprint-sections">
      {business.profile.elevatorPitch && (
        <CollapsibleSection title="Elevator pitch" defaultOpen delay={nextSectionDelay()}>
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
        </CollapsibleSection>
      )}

      {/* Profile */}
      {(business.profile.industry || business.profile.summary) && (
        <CollapsibleSection title="Profile" defaultOpen delay={nextSectionDelay()}>
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
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Business plan"
        defaultOpen={planInFlight || (hasBusinessPlan && !planComplete)}
        delay={nextSectionDelay()}
        actions={
          !planComplete && !planInFlight && !detail.consultInFlight ? (
            <button
              type="button"
              className="forge-cta"
              disabled={planBusy || detail.consultInFlight || planInFlight}
              onClick={() => void requestPlan()}
              style={{ fontSize: '0.72rem', padding: '6px 12px' }}
            >
              {planBusy ? 'Starting…' : hasBusinessPlan ? 'Complete business plan' : 'Generate business plan'}
            </button>
          ) : null
        }
      >
        {planComplete && (
          <p className="forge-hint">
            Eight-section operator plan — expand any section from the table of contents.
          </p>
        )}

        {!planComplete && !hasBusinessPlan && !planInFlight && (
          <p className="forge-hint">
            No business plan yet. Generate one from the business description and profile — eight collapsible sections with a table of contents.
          </p>
        )}

        {!planComplete && hasBusinessPlan && !planInFlight && (
          <p className="forge-hint">
            Plan is incomplete — generate the remaining sections.
          </p>
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
            <div style={{ marginTop: 10 }}>
              <TurnTimeline turns={planTurns} />
            </div>
          </>
        )}

        {planError && <p className="forge-error" style={{ marginTop: 10 }}>{planError}</p>}

        {hasBusinessPlan && (
          <div style={{ marginTop: planInFlight ? 14 : 0 }}>
            <BusinessPlanViewer plan={business.profile.businessPlan} />
          </div>
        )}

        {competitorAnalysisHasContent(business.profile.competitorAnalysis) && (
          <div style={{ marginTop: 18 }}>
            <h3 className="forge-label" style={{ marginBottom: 6 }}>
              Competitor analysis
            </h3>
            <CompetitorAnalysisViewer analysis={business.profile.competitorAnalysis} />
          </div>
        )}
      </CollapsibleSection>

      {/* Market assessment — advisory viability verdict */}
      <CollapsibleSection
        title="Market assessment"
        defaultOpen={hasMarketAssessment || marketStreamHere}
        delay={nextSectionDelay()}
        actions={
          !marketComplete && !marketStreamHere && !detail.consultInFlight && !planStreamHere ? (
            <button
              type="button"
              className="forge-cta"
              disabled={marketBusy || detail.consultInFlight || planInFlight}
              onClick={() => void requestMarket()}
              style={{ fontSize: '0.72rem', padding: '6px 12px' }}
            >
              {marketBusy
                ? 'Starting…'
                : hasMarketAssessment
                  ? 'Complete market assessment'
                  : 'Assess market & viability'}
            </button>
          ) : null
        }
      >
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
            <div style={{ marginTop: 10 }}>
              <TurnTimeline turns={planTurns} />
            </div>
          </>
        )}

        {marketError && <p className="forge-error" style={{ marginTop: 10 }}>{marketError}</p>}

        {hasMarketAssessment && (
          <div style={{ marginTop: marketStreamHere ? 14 : 0 }}>
            <MarketAssessmentViewer assessment={business.profile.marketAssessment} />
          </div>
        )}
      </CollapsibleSection>

      {/* App stack override grid */}
      <CollapsibleSection title="Software stack" count={appStack.length} delay={nextSectionDelay()}>
        <p className="forge-hint">
          One default per category (★). Click an alternative to override what agents get access to.
        </p>
        <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
          {appStack.map((group) => (
            <div key={group.appTypeKey}>
              <div className="forge-hint" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.66rem' }}>
                {group.appTypeLabel}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {group.options.map((opt) => {
                  const selected = opt.appId === group.selectedAppId;
                  return (
                    <button
                      key={opt.appId}
                      type="button"
                      onClick={() => !selected && void selectApp(opt.appId)}
                      title={opt.rationale}
                      style={{
                        cursor: selected ? 'default' : 'pointer',
                        fontSize: '0.74rem',
                        padding: '5px 12px',
                        borderRadius: 5,
                        border: `1px solid ${selected ? 'rgba(120,220,180,0.8)' : 'rgba(120,200,170,0.3)'}`,
                        background: selected ? 'rgba(120,220,180,0.16)' : 'transparent',
                        color: selected ? '#eafff4' : '#9fd8c4',
                      }}
                    >
                      {opt.isAgentDefault ? '★ ' : ''}
                      {opt.app.name}
                      <span style={{ opacity: 0.6, marginLeft: 5, fontSize: '0.64rem' }}>{opt.app.kind}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {appStack.length === 0 && <p className="forge-hint">No apps recommended yet.</p>}
        </div>
      </CollapsibleSection>

      {/* Roles */}
      <CollapsibleSection
        title="Agent roles"
        count={roles.length}
        defaultOpen={suggestedRoles.length > 0 || !!forgeQueue?.active}
        delay={nextSectionDelay()}
        actions={
          suggestedRoles.length > 0 ? (
            <button
              type="button"
              className="forge-cta"
              disabled={forgeBusy}
              onClick={() => void forge()}
              style={{ fontSize: '0.72rem', padding: '6px 12px' }}
            >
              {forgeQueueActive ? 'Forging…' : busy ? 'Starting…' : `⚡ Forge all (${suggestedRoles.length})`}
            </button>
          ) : null
        }
      >
        {forgeQueue?.active ? <ForgeQueueProgress queue={forgeQueue} /> : null}
        {forgeError ? <p className="forge-error" style={{ marginTop: 10 }}>{forgeError}</p> : null}
        <div className="forge-role-list">
          {roles.map((role) => (
            <div key={role.id} className="forge-role-item">
              <div className="forge-role-row">
                <div className="forge-role-title">
                  {role.title}
                  <span className="forge-hint forge-role-meta">
                    authority {role.authorityHint}
                  </span>
                </div>
                <div className="forge-role-action">
                {role.status === 'suggested' ? (
                  <button type="button" className="forge-cta forge-cta--ghost forge-cta--sm" disabled={forgeBusy} onClick={() => void forge(role.id)}>
                    Forge
                  </button>
                ) : role.agentSlug ? (
                  <Link href={`/agent/${role.agentSlug}`} className="forge-hint forge-role-status">
                    {role.status} →
                  </Link>
                ) : (
                  <span className="forge-hint forge-role-status">{role.status}</span>
                )}
                </div>
              </div>
              <ForgeMarkdown className="forge-markdown--role">{role.jobDescription}</ForgeMarkdown>
            </div>
          ))}
          {roles.length === 0 && <p className="forge-hint">No roles suggested yet.</p>}
        </div>
      </CollapsibleSection>

      {/* Forged agents + access grids */}
      {agents.length > 0 && (
        <CollapsibleSection title="Forged agents" count={agents.length} delay={nextSectionDelay()}>
          <div className="forge-agent-license-grid">
            {agents.map((a) => (
              <ForgedAgentLicense key={a.slug} agent={a} businessName={business.name} />
            ))}
          </div>
        </CollapsibleSection>
      )}
      </div>
          </div>
        </div>
      </div>
    </div>
  );
}
