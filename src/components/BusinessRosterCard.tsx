'use client';

import React from 'react';
import Link from 'next/link';
import { HudBox } from '@/components/HudBox';
import { ForgeDecodeText, ForgeFlowText, ForgeHeaderText } from '@/components/ForgeArwesText';
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
  const snippet = business.description.slice(0, 200);
  const footer = `${business.roleCount} role(s) · ${business.appCount} app(s) selected · ${business.agentCount} agent(s) forged`;

  return (
    <Link href={`/business/${business.slug}`} style={{ textDecoration: 'none' }}>
      <HudBox variant="rect">
        <div className="forge-roster-card">
          <div className="forge-roster-card-main">
            <ForgeHeaderText
              as="div"
              duration={0.85}
              delay={d('name', 0)}
              animateId={`${business.slug}:name:${business.name}`}
              playOnce
              contentStyle={{
                color: '#dffaf0',
                fontWeight: 700,
                fontSize: '1.05rem',
                fontFamily: 'inherit',
              }}
            >
              {business.name}
              {business.isPlaceholder && (
                <span className="forge-hint" style={{ marginLeft: 8, fontSize: '0.68rem', fontWeight: 400 }}>
                  (default home)
                </span>
              )}
            </ForgeHeaderText>
            <ForgeFlowText
              as="p"
              className="forge-hint"
              layout="block"
              delay={d('desc', 0.1)}
              animateId={`${business.slug}:desc:${snippet}`}
              playOnce
              contentStyle={{ margin: '6px 0 0', maxWidth: 720 }}
            >
              {snippet}
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
              contentStyle={{ color: 'inherit' }}
            >
              {STATUS_LABEL[business.status] ?? business.status}
            </ForgeDecodeText>
          </span>
        </div>
        <ForgeFlowText
          as="div"
          className="forge-hint"
          layout="block"
          delay={d('meta', 0.18)}
          animateId={`${business.slug}:meta:${footer}`}
          playOnce
          contentStyle={{ marginTop: 10, fontSize: '0.72rem' }}
        >
          {footer}
        </ForgeFlowText>
      </HudBox>
    </Link>
  );
}

export default BusinessRosterCard;
