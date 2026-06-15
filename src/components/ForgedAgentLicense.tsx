'use client';

import React from 'react';
import Link from 'next/link';
import { AgentAccessGrid } from '@/components/AgentAccessGrid';
import type { BusinessAgentSummary } from '@/lib/businessStore';

function formatLicenseDate(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

function operatorId(slug: string): string {
  const core = slug.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `AF-${core}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'complete':
      return 'Active';
    case 'generating':
      return 'Forging';
    case 'queued':
      return 'Queued';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

type ForgedAgentLicenseProps = {
  agent: BusinessAgentSummary;
  businessName: string;
};

/** Driver's-license-style operator card for forged agents on business blueprints. */
export function ForgedAgentLicense({ agent, businessName }: ForgedAgentLicenseProps) {
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const [emblemFailed, setEmblemFailed] = React.useState(false);
  const accent = agent.accent ?? '#7fe7ff';
  const photoSrc = !photoFailed && agent.portraitPath ? agent.portraitPath : agent.iconPath;
  const emblemSrc = !emblemFailed && agent.emblemPath ? `${agent.emblemPath}?v=${agent.updatedAt}` : undefined;
  const pending = agent.status !== 'complete';

  return (
    <Link
      href={`/agent/${agent.slug}`}
      className={`forge-agent-license${pending ? ' forge-agent-license--pending' : ''}${agent.status === 'error' ? ' forge-agent-license--error' : ''}`}
      style={{ ['--license-accent' as string]: accent }}
    >
      <div className="forge-agent-license__banner">
        <span className="forge-agent-license__issuer">Agent Forge</span>
        <span className="forge-agent-license__doc-type">Operator License</span>
      </div>

      <div className="forge-agent-license__body">
        <div className="forge-agent-license__photo-wrap">
          <div className="forge-agent-license__photo">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt=""
                className="forge-agent-license__photo-img"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <span className="forge-agent-license__photo-fallback" aria-hidden>
                ◆
              </span>
            )}
          </div>
          {emblemSrc ? (
            <div className="forge-agent-license__emblem">
              <img
                src={emblemSrc}
                alt=""
                className="forge-agent-license__emblem-img"
                onError={() => setEmblemFailed(true)}
              />
            </div>
          ) : null}
          <span className="forge-agent-license__class">Class {agent.authority}</span>
        </div>

        <div className="forge-agent-license__main">
          <div className="forge-agent-license__field forge-agent-license__field--name">
            <span className="forge-agent-license__label">Name</span>
            <span className="forge-agent-license__value forge-agent-license__name">{agent.title}</span>
          </div>

          <div className="forge-agent-license__grid">
            <div className="forge-agent-license__field">
              <span className="forge-agent-license__label">Operator ID</span>
              <span className="forge-agent-license__value">{operatorId(agent.slug)}</span>
            </div>
            <div className="forge-agent-license__field">
              <span className="forge-agent-license__label">Issued</span>
              <span className="forge-agent-license__value">{formatLicenseDate(agent.createdAt)}</span>
            </div>
            <div className="forge-agent-license__field">
              <span className="forge-agent-license__label">Employer</span>
              <span className="forge-agent-license__value">{businessName}</span>
            </div>
            <div className="forge-agent-license__field">
              <span className="forge-agent-license__label">Status</span>
              <span className="forge-agent-license__value" data-status={agent.status}>
                {statusLabel(agent.status)}
              </span>
            </div>
            {agent.callsign ? (
              <div className="forge-agent-license__field">
                <span className="forge-agent-license__label">Callsign</span>
                <span className="forge-agent-license__value">{agent.callsign}</span>
              </div>
            ) : null}
            {agent.department ? (
              <div className="forge-agent-license__field">
                <span className="forge-agent-license__label">Dept</span>
                <span className="forge-agent-license__value">{agent.department}</span>
              </div>
            ) : null}
          </div>

          <div className="forge-agent-license__endorsements">
            <span className="forge-agent-license__label">Endorsements</span>
            <AgentAccessGrid slug={agent.slug} variant="license" />
          </div>
        </div>
      </div>

      <div className="forge-agent-license__footer">
        <div className="forge-agent-license__barcode" aria-hidden />
        <span className="forge-agent-license__micro">{agent.skillsFile ?? agent.slug}</span>
      </div>
    </Link>
  );
}

export default ForgedAgentLicense;
