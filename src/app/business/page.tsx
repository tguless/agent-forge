'use client';

import React from 'react';
import Link from 'next/link';
import { HudBox } from '@/components/HudBox';
import type { BusinessSummary } from '@/lib/businessTypes';

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  consulting: 'Consulting…',
  ready: 'Ready',
  error: 'Error',
};

export default function BusinessRosterPage() {
  const [businesses, setBusinesses] = React.useState<BusinessSummary[] | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/businesses', { cache: 'no-store' });
      const json = (await res.json()) as { businesses: BusinessSummary[] };
      setBusinesses(json.businesses);
      return json.businesses.every((b) => b.status === 'ready' || b.status === 'error');
    } catch {
      return false;
    }
  }, []);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    void load().then((done) => {
      if (!done) timer = setInterval(async () => {
        if (await load()) timer && clearInterval(timer);
      }, 3000);
    });
    return () => timer && clearInterval(timer);
  }, [load]);

  return (
    <div className="ops-font-scope forge-page">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <Link href="/" className="ops-detail-back" style={{ position: 'static' }}>
          ← All agents
        </Link>
        <Link href="/business/new" className="forge-cta" style={{ padding: '6px 14px', fontSize: '0.72rem' }}>
          + New business
        </Link>
      </div>

      <div className="forge-wordmark forge-wordmark--lg" style={{ marginBottom: 6 }}>
        BUSINESS<span>BLUEPRINTS</span>
      </div>
      <p className="forge-hint">
        Describe a business and the consultant designs its agent workforce — the roles to forge and the
        SaaS/OSS stack each agent gets access to.
      </p>

      {!businesses && <div className="forge-empty">Loading businesses…</div>}

      {businesses && businesses.length === 0 && (
        <div className="forge-empty">
          No businesses yet. <Link href="/business/new" className="forge-cta forge-cta--ghost">Create one</Link>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        {businesses?.map((b) => (
          <Link key={b.slug} href={`/business/${b.slug}`} style={{ textDecoration: 'none' }}>
            <HudBox variant="rect">
              <div className="forge-roster-card">
                <div className="forge-roster-card-main">
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#dffaf0' }}>
                    {b.name}
                    {b.isPlaceholder && (
                      <span className="forge-hint" style={{ marginLeft: 8, fontSize: '0.68rem' }}>
                        (default home)
                      </span>
                    )}
                  </div>
                  <p className="forge-hint" style={{ margin: '6px 0 0', maxWidth: 720 }}>
                    {b.description.slice(0, 200)}
                  </p>
                </div>
                <span
                  className="forge-log-row forge-roster-status"
                  data-type={b.status === 'error' ? 'error' : b.status === 'ready' ? 'done' : undefined}
                >
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
              </div>
              <div className="forge-hint" style={{ marginTop: 10, fontSize: '0.72rem' }}>
                {b.roleCount} role(s) · {b.appCount} app(s) selected · {b.agentCount} agent(s) forged
              </div>
            </HudBox>
          </Link>
        ))}
      </div>
    </div>
  );
}
