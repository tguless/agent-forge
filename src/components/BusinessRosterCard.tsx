'use client';

import React from 'react';
import Link from 'next/link';
import { ForgeInteractiveHudBox } from '@/components/ForgeInteractiveHudBox';
import { ForgeDecodeText, ForgeFlowText, ForgeHeaderText } from '@/components/ForgeArwesText';
import { useForgeCardLayoutLock } from '@/hooks/useForgeCardLayoutLock';
import { useTextFillDelay } from '@/hooks/useTextFillDelay';
import type { BusinessSummary } from '@/lib/businessTypes';

const CARD_STAGGER_S = 0.22;

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  consulting: 'Consulting…',
  ready: 'Ready',
  error: 'Error',
};

export function BusinessRosterCard({
  business,
  staggerIndex = 0,
}: {
  business: BusinessSummary;
  staggerIndex?: number;
}) {
  const fillDelay = useTextFillDelay();
  const cardBase = staggerIndex * CARD_STAGGER_S;
  const d = (key: string, offset: number) => fillDelay(`${business.slug}:${key}`, cardBase + offset);
  const description = business.description;
  const footer = `${business.roleCount} role(s) · ${business.appCount} app(s) selected · ${business.agentCount} agent(s) forged`;
  const layoutRef = useForgeCardLayoutLock([
    business.slug,
    business.name,
    business.isPlaceholder,
    description,
    footer,
    business.status,
  ]);

  return (
    <Link href={`/business/${business.slug}`} style={{ textDecoration: 'none' }}>
      <ForgeInteractiveHudBox variant="rect" className="forge-roster-card-box">
        <div ref={layoutRef} className="forge-roster-card-layout">
        <div className="forge-roster-card">
          <div className="forge-roster-card-main">
            <ForgeHeaderText
              as="p"
              className="forge-roster-card-name"
              layout="block"
              duration={0.85}
              delay={d('name', 0)}
              animateId={`${business.slug}:name`}
              playOnce
              reserveLayout
              contentStyle={{ color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
            >
              {business.name}
              {business.isPlaceholder && (
                <span className="forge-hint forge-roster-card-placeholder">(default home)</span>
              )}
            </ForgeHeaderText>
            <ForgeFlowText
              as="p"
              className="forge-hint forge-roster-card-desc"
              layout="block"
              delay={d('desc', 0.1)}
              animateId={`${business.slug}:desc`}
              playOnce
              reserveLayout
            >
              {description}
            </ForgeFlowText>
          </div>
          <span
            className="forge-log-row forge-roster-status"
            data-type={business.status === 'error' ? 'error' : business.status === 'ready' ? 'done' : undefined}
          >
            <ForgeDecodeText
              animateId={`${business.slug}:status:${business.status}`}
              playOnce
              delay={d('status', 0.05)}
              layout="inline"
              reserveLayout
              contentStyle={{ color: 'inherit' }}
            >
              {STATUS_LABEL[business.status] ?? business.status}
            </ForgeDecodeText>
          </span>
        </div>
        <ForgeFlowText
          as="p"
          className="forge-hint forge-roster-card-meta"
          layout="block"
          delay={d('meta', 0.18)}
          animateId={`${business.slug}:meta`}
          playOnce
          reserveLayout
        >
          {footer}
        </ForgeFlowText>
        </div>
      </ForgeInteractiveHudBox>
    </Link>
  );
}

export default BusinessRosterCard;
