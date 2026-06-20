'use client';

import React from 'react';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import type { BusinessRole } from '@/lib/businessTypes';

type BlueprintRoleItemProps = {
  role: BusinessRole;
  forgeBusy?: boolean;
  onForge?: (roleId: number) => void;
};

/** Suggested role on the blueprint Team tab — expanded with job description + Forge CTA. */
export function BlueprintRoleItem({ role, forgeBusy, onForge }: BlueprintRoleItemProps) {
  return (
    <div className="forge-role-item forge-role-item--open">
      <div className="forge-role-row">
        <div className="forge-role-title">
          {role.title}
          <span className="forge-hint forge-role-meta">authority {role.authorityHint}</span>
        </div>
        <div className="forge-role-action">
          <button
            type="button"
            className="forge-cta forge-cta--ghost forge-cta--sm"
            disabled={forgeBusy}
            onClick={() => onForge?.(role.id)}
          >
            Forge
          </button>
        </div>
      </div>
      <ForgeMarkdown className="forge-markdown--role">{role.jobDescription}</ForgeMarkdown>
    </div>
  );
}
