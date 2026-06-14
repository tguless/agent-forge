'use client';

import React from 'react';
import Link from 'next/link';
import { HudBox } from '@/components/HudBox';
import { AgentAccessGrid } from '@/components/AgentAccessGrid';
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
  roles: BusinessRole[];
  appStack: StackGroup[];
  agents: BusinessAgent[];
  capacities: Capacity[];
};

export default function BlueprintPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/businesses/${slug}`, { cache: 'no-store' });
    if (!res.ok) return true;
    const json = (await res.json()) as Detail;
    setDetail(json);
    const agentsSettling = json.agents.some((a) => a.status === 'queued' || a.status === 'generating');
    return !json.consultInFlight && !agentsSettling;
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

  if (!detail) return <div className="ops-font-scope forge-empty">Loading blueprint…</div>;

  const { business, roles, appStack, agents } = detail;
  const suggestedRoles = roles.filter((r) => r.status === 'suggested');

  return (
    <div className="ops-font-scope forge-page">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <Link href="/business" className="ops-detail-back" style={{ position: 'static' }}>
          ← All businesses
        </Link>
        <Link href="/business/new" className="forge-cta forge-cta--ghost" style={{ padding: '6px 12px', fontSize: '0.72rem' }}>
          + New business
        </Link>
      </div>

      <div className="forge-wordmark forge-wordmark--lg" style={{ marginBottom: 6 }}>
        {business.name}
      </div>
      <p className="forge-hint" style={{ maxWidth: 760 }}>{business.description}</p>

      {detail.consultInFlight && (
        <div className="forge-status-line" style={{ marginTop: 12 }}>
          <span className="forge-spinner" aria-hidden /> Consultant is still building this blueprint…
        </div>
      )}
      {business.status === 'error' && (
        <p className="forge-error" style={{ marginTop: 12 }}>Consulting failed: {business.error}</p>
      )}

      {/* Profile */}
      {(business.profile.industry || business.profile.summary) && (
        <HudBox variant="rect" style={{ marginTop: 18 }}>
          <h2 className="forge-label">Profile</h2>
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
        </HudBox>
      )}

      {/* App stack override grid */}
      <HudBox variant="rect" style={{ marginTop: 16 }}>
        <h2 className="forge-label">Software stack</h2>
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
      </HudBox>

      {/* Roles */}
      <HudBox variant="rect" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 className="forge-label" style={{ margin: 0 }}>Agent roles</h2>
          {suggestedRoles.length > 0 && (
            <button type="button" className="forge-cta" disabled={busy} onClick={() => void forge()}>
              {busy ? 'Forging…' : `⚡ Forge all (${suggestedRoles.length})`}
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
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
              <p className="forge-hint" style={{ margin: '4px 0 0', maxWidth: 760 }}>{role.jobDescription}</p>
            </div>
          ))}
          {roles.length === 0 && <p className="forge-hint">No roles suggested yet.</p>}
        </div>
      </HudBox>

      {/* Forged agents + access grids */}
      {agents.length > 0 && (
        <HudBox variant="rect" style={{ marginTop: 16 }}>
          <h2 className="forge-label">Forged agents &amp; access grid</h2>
          <div style={{ display: 'grid', gap: 16, marginTop: 12 }}>
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
        </HudBox>
      )}
    </div>
  );
}
