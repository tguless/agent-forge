'use client';

import React from 'react';
import { ForgeDecodeText } from '@/components/ForgeArwesText';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
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
          {role.jobDescription?.trim() && (
            <EditSectionButton
              label="Edit role"
              onClick={() =>
                setEditTarget({
                  path: ['roles', String(role.id), 'jobDescription'],
                  label: `${role.title} — Job description`,
                  content: role.jobDescription.trim(),
                })
              }
            />
          )}
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
      <ForgeMarkdown className="forge-markdown--role" animated animatePrefix={`role:${role.id}`}>
        {role.jobDescription}
      </ForgeMarkdown>

      <EditableSectionHost
        slug={slug}
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => onSaved?.()}
      />
    </div>
  );
}
