'use client';

import React from 'react';
import { ForgedAgentLicense } from '@/components/ForgedAgentLicense';
import { ForgeFlowText } from '@/components/ForgeArwesText';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import type { BusinessAgentSummary } from '@/lib/businessStore';
import type { BusinessRole } from '@/lib/businessTypes';

type ForgedAgentRolePairProps = {
  agent: BusinessAgentSummary;
  role?: BusinessRole;
  businessName: string;
  forgePhase?: 'running' | 'pending';
};

/** One forged agent: license card left, that role's brief right; stacks on phone. */
export function ForgedAgentRolePair({ agent, role, businessName, forgePhase }: ForgedAgentRolePairProps) {
  return (
    <div className="forge-agent-role-split">
      <div className="forge-agent-role-split__card">
        <ForgedAgentLicense agent={agent} businessName={businessName} forgePhase={forgePhase} />
      </div>
      <div className="forge-agent-role-split__brief">
        {role?.jobDescription?.trim() ? (
          <ForgeMarkdown
            className="forge-markdown--role"
            animated
            animatePrefix={`agent-role:${agent.slug}`}
          >
            {role.jobDescription}
          </ForgeMarkdown>
        ) : (
          <ForgeFlowText
            as="p"
            className="forge-hint"
            layout="block"
            animateId={`agent-role-empty:${agent.slug}`}
            playOnce
            delay={0.04}
          >
            No role brief on file for this operator.
          </ForgeFlowText>
        )}
      </div>
    </div>
  );
}
