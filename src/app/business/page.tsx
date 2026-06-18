'use client';

import React from 'react';
import Link from 'next/link';
import { BusinessRosterCard } from '@/components/BusinessRosterCard';
import { ForgeAnimatedPageHeader } from '@/components/ForgeAnimatedPageHeader';
import { ForgePageShell } from '@/components/ForgePageShell';
import { ForgeTopNav } from '@/components/ForgeTopNav';
import type { BusinessSummary } from '@/lib/businessTypes';

const ROSTER_LEAD =
  'Describe a business and the consultant designs its agent workforce — the roles to forge and the SaaS/OSS stack each agent gets access to.';

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
      if (!done) {
        timer = setInterval(async () => {
          if (await load()) timer && clearInterval(timer);
        }, 3000);
      }
    });
    return () => timer && clearInterval(timer);
  }, [load]);

  return (
    <ForgePageShell
      frame="hud"
      shellClassName="forge-roster-shell"
      nav={<ForgeTopNav variant="dashboard" />}
    >
      <ForgeAnimatedPageHeader
        scope="business-roster"
        wordmarkChars={17}
        wordmark={
          <>
            BUSINESS<span>BLUEPRINTS</span>
          </>
        }
        lead={ROSTER_LEAD}
      />

      {!businesses && <div className="forge-empty">Loading businesses…</div>}

      {businesses && businesses.length === 0 && (
        <div className="forge-empty">
          No businesses yet.{' '}
          <Link href="/business/new" className="forge-cta forge-cta--ghost">
            Create one
          </Link>
        </div>
      )}

      <div className="forge-business-roster">
        {businesses?.map((b, index) => (
          <BusinessRosterCard key={b.slug} business={b} staggerIndex={index} />
        ))}
      </div>
    </ForgePageShell>
  );
}
