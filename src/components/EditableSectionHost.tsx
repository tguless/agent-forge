'use client';

import React from 'react';
import { ForgeTextEditor } from '@/components/ForgeTextEditor';

import type { EditableTarget } from '@/lib/editableSections';

type Props = {
  slug: string;
  target: EditableTarget | null;
  onClose: () => void;
  onSaved: () => void;
};

/** Host for ForgeTextEditor — pass target to open, null to close. */
export function EditableSectionHost({ slug, target, onClose, onSaved }: Props) {
  if (!target) return null;
  return (
    <ForgeTextEditor
      slug={slug}
      sectionPath={target.path}
      sectionLabel={target.label}
      initialContent={target.content}
      canRewrite={target.canRewrite ?? true}
      onClose={onClose}
      onSaved={() => {
        onClose();
        onSaved();
      }}
    />
  );
}

type EditButtonProps = {
  label?: string;
  onClick: () => void;
  className?: string;
};

export function EditSectionButton({ label = 'Edit', onClick, className }: EditButtonProps) {
  return (
    <button
      type="button"
      className={['forge-cta forge-cta--ghost forge-cta--sm', className].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
