'use client';

import React from 'react';
import Link from 'next/link';
import { HudBox } from '@/components/HudBox';
import { BusinessPlanViewer } from '@/components/BusinessPlanViewer';
import { CompetitorAnalysisViewer } from '@/components/CompetitorAnalysisViewer';
import { competitorAnalysisHasContent } from '@/lib/competitorSections';
import { TurnTimeline, useBusinessPlanStream } from '@/components/TurnTimeline';
import { AgentAccessGrid } from '@/components/AgentAccessGrid';
import { BusinessPlaque } from '@/components/BusinessPlaque';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
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

type BusinessAgent = {
  slug: string;
  title: string;
  status: string;
  authority: number;
};

type Detail = {
  business: Business;
  consultInFlight: boolean;
  planInFlight: boolean;
  hasBusinessPlan: boolean;
  planComplete: boolean;
  roles: BusinessRole[];
  appStack: StackGroup[];
  agents: BusinessAgent[];
  capacities: Capacity[];
};

function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  actions,
  children,
  marginTop = 16,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  marginTop?: number;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <HudBox variant="rect" style={{ marginTop }}>
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
          <span className="forge-collapse-title">{title}</span>
          {typeof count === 'number' && <span className="forge-collapse-count">{count}</span>}
        </button>
        {actions && <div className="forge-collapse-actions">{actions}</div>}
      </div>
      {open && <div className="forge-collapse-body">{children}</div>}
    </HudBox>
  );
}

export default function BlueprintPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [planBusy, setPlanBusy] = React.useState(false);
  const [planError, setPlanError] = React.useState<string | null>(null);

  const planStreamActive = detail?.planInFlight ?? false;
  const { turns: planTurns, done: planDone } = useBusinessPlanStream(slug, planStreamActive);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/businesses/${slug}`, { cache: 'no-store' });
    if (!res.ok) return true;
    const json = (await res.json()) as Detail;
    setDetail(json);
    const agentsSettling = json.agents.some((a) => a.status === 'queued' || a.status === 'generating');
    return !json.consultInFlight && !json.planInFlight && !agentsSettling;
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
    setBusy(true);
    try {
      await fetch(`/api/businesses/${slug}/forge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(roleId != null ? { roleId } : {}),
      });
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
      await load();
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to start plan generation');
    } finally {
      setPlanBusy(false);
    }
  };

  if (!detail) return <div className="ops-font-scope forge-empty">Loading blueprint…</div>;

  const { business, roles, appStack, agents, planInFlight, hasBusinessPlan, planComplete } = detail;
  const suggestedRoles = roles.filter((r) => r.status === 'suggested');

  const industryTag = business.profile.industry ?? 'Business blueprint';

  return (
    <div className="ops-detail-page forge-blueprint-page">
      <div className="ops-detail-toolbar">
        <Link href="/business" className="ops-detail-back">
          ← All businesses
        </Link>
        <Link href="/business/new" className="forge-cta forge-cta--ghost" style={{ padding: '6px 12px', fontSize: '0.72rem' }}>
          + New business
        </Link>
      </div>

      <div className="ops-detail-shell">
        <span className="ops-detail-corner ops-detail-corner-tl" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-tr" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-bl" aria-hidden />
        <span className="ops-detail-corner ops-detail-corner-br" aria-hidden />

        <div className="ops-detail-inner">
          <header className="ops-detail-header forge-blueprint-header">
            <div className="ops-detail-brand">
              <div className="forge-wordmark">
                AGENT<span>FORGE</span>
              </div>
              <div className="ops-detail-brand-tag">Business blueprint</div>
            </div>
            <div className="ops-detail-title-block">
              <h1 className="ops-detail-title">{business.name}</h1>
              <p className="ops-detail-subtitle">{industryTag}</p>
            </div>
            <BusinessPlaque business={business} disabled={detail.consultInFlight} />
          </header>

          <div className="forge-blueprint-body">
            <p className="forge-hint" style={{ maxWidth: 760, marginTop: 0 }}>{business.description}</p>

      {detail.consultInFlight && (
        <div className="forge-status-line" style={{ marginTop: 12 }}>
          <span className="forge-spinner" aria-hidden /> Consultant is still building this blueprint…
        </div>
      )}
      {business.status === 'error' && (
        <p className="forge-error" style={{ marginTop: 12 }}>Consulting failed: {business.error}</p>
      )}

      {business.profile.elevatorPitch && (
        <CollapsibleSection title="Elevator pitch" defaultOpen marginTop={18}>
          <p className="forge-elevator-pitch">{business.profile.elevatorPitch}</p>
        </CollapsibleSection>
      )}

      {/* Profile */}
      {(business.profile.industry || business.profile.summary) && (
        <CollapsibleSection title="Profile" defaultOpen>
          {business.profile.industry && (
            <p className="forge-hint"><strong>Industry:</strong> {business.profile.industry}</p>
          )}
          {business.profile.businessModel && (
            <p className="forge-hint"><strong>Model:</strong> {business.profile.businessModel}</p>
          )}
          {business.profile.summary && <p className="forge-hint">{business.profile.summary}</p>}
          {!!business.profile.valueChain?.length && (
            <p className="forge-hint">
              <strong>Value chain:</strong> {business.profile.valueChain.join(' → ')}
            </p>
          )}
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Business plan"
        defaultOpen={planInFlight || (hasBusinessPlan && !planComplete)}
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

        {planInFlight && (
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

      {/* App stack override grid */}
      <CollapsibleSection title="Software stack" count={appStack.length}>
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
        defaultOpen={suggestedRoles.length > 0}
        actions={
          suggestedRoles.length > 0 ? (
            <button
              type="button"
              className="forge-cta"
              disabled={busy}
              onClick={() => void forge()}
              style={{ fontSize: '0.72rem', padding: '6px 12px' }}
            >
              {busy ? 'Forging…' : `⚡ Forge all (${suggestedRoles.length})`}
            </button>
          ) : null
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {roles.map((role) => (
            <div key={role.id} style={{ borderBottom: '1px solid rgba(120,200,170,0.12)', paddingBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <div style={{ fontWeight: 600, color: '#dffaf0' }}>
                  {role.title}
                  <span className="forge-hint" style={{ marginLeft: 8, fontSize: '0.66rem' }}>
                    authority {role.authorityHint}
                  </span>
                </div>
                {role.status === 'suggested' ? (
                  <button type="button" className="forge-cta forge-cta--ghost" disabled={busy} onClick={() => void forge(role.id)} style={{ fontSize: '0.7rem', padding: '4px 12px' }}>
                    Forge
                  </button>
                ) : role.agentSlug ? (
                  <Link href={`/agent/${role.agentSlug}`} className="forge-hint" style={{ fontSize: '0.7rem' }}>
                    {role.status} →
                  </Link>
                ) : (
                  <span className="forge-hint" style={{ fontSize: '0.7rem' }}>{role.status}</span>
                )}
              </div>
              <ForgeMarkdown className="forge-markdown--role">{role.jobDescription}</ForgeMarkdown>
            </div>
          ))}
          {roles.length === 0 && <p className="forge-hint">No roles suggested yet.</p>}
        </div>
      </CollapsibleSection>

      {/* Forged agents + access grids */}
      {agents.length > 0 && (
        <CollapsibleSection title="Forged agents & access grid" count={agents.length}>
          <div style={{ display: 'grid', gap: 16 }}>
            {agents.map((a) => (
              <div key={a.slug}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <Link href={`/agent/${a.slug}`} style={{ fontWeight: 600, color: '#dffaf0', textDecoration: 'none' }}>
                    {a.title}
                  </Link>
                  <span className="forge-hint" style={{ fontSize: '0.68rem' }}>{a.status}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <AgentAccessGrid slug={a.slug} compact />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
          </div>
        </div>
      </div>
    </div>
  );
}
