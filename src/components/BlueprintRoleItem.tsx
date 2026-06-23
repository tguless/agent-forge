'use client';

import React from 'react';
import { ForgeDecodeText } from '@/components/ForgeArwesText';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import { ForgeFlowText } from '@/components/ForgeArwesText';
import { EditableSectionHost, EditSectionButton } from '@/components/EditableSectionHost';
import type { EditableTarget } from '@/lib/editableSections';
import type { BusinessRole } from '@/lib/businessTypes';

type BlueprintRoleItemProps = {
  slug: string;
  role: BusinessRole;
  forgeBusy?: boolean;
  onForge?: (roleId: number) => void;
  onSaved?: () => void;
};

/** Suggested role on the blueprint Team tab — expanded with job description + Forge CTA. */
export function BlueprintRoleItem({ slug, role, forgeBusy, onForge, onSaved }: BlueprintRoleItemProps) {
  const [editTarget, setEditTarget] = React.useState<EditableTarget | null>(null);

  const openEdit = (field: 'jobDescription' | 'businessContext' | 'rationale', label: string, content: string) => {
    setEditTarget({
      path: ['roles', String(role.id), field],
      label: `${role.title} — ${label}`,
      content,
    });
  };

  return (
    <div className="forge-role-item forge-role-item--open">
      <div className="forge-role-row">
        <div className="forge-role-title">
          <ForgeDecodeText
            layout="inline"
            animateId={`role-title:${role.id}`}
            playOnce
            delay={0.02}
            contentStyle={{ color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
          >
            {role.title}
          </ForgeDecodeText>
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

      {role.businessContext?.trim() && (
        <div className="forge-role-extra">
          <div className="spread forge-plan-subpanel-head">
            <span className="forge-hint">Business context</span>
            <EditSectionButton
              label="Edit"
              onClick={() => openEdit('businessContext', 'Business context', role.businessContext.trim())}
            />
          </div>
          <ForgeFlowText as="p" className="forge-hint" layout="block" animateId={`role-ctx:${role.id}`} playOnce>
            {role.businessContext}
          </ForgeFlowText>
        </div>
      )}

      {role.jobDescription?.trim() && (
        <div className="forge-role-extra">
          <div className="spread forge-plan-subpanel-head">
            <span className="forge-hint">Job description</span>
            <EditSectionButton
              label="Edit"
              onClick={() => openEdit('jobDescription', 'Job description', role.jobDescription.trim())}
            />
          </div>
          <ForgeMarkdown className="forge-markdown--role" animated animatePrefix={`role:${role.id}`}>
            {role.jobDescription}
          </ForgeMarkdown>
        </div>
      )}

      {role.rationale?.trim() && (
        <div className="forge-role-extra">
          <div className="spread forge-plan-subpanel-head">
            <span className="forge-hint">Rationale</span>
            <EditSectionButton
              label="Edit"
              onClick={() => openEdit('rationale', 'Rationale', role.rationale.trim())}
            />
          </div>
          <ForgeFlowText as="p" className="forge-hint" layout="block" animateId={`role-rat:${role.id}`} playOnce>
            {role.rationale}
          </ForgeFlowText>
        </div>
      )}

      <EditableSectionHost
        slug={slug}
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => onSaved?.()}
      />
    </div>
  );
}
