'use client';

import React from 'react';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import {
  BUSINESS_PLAN_SECTIONS,
  businessPlanHasContent,
  filledBusinessPlanSections,
} from '@/lib/businessPlanSections';
import type { BusinessPlanSections } from '@/lib/businessTypes';

type BusinessPlanViewerProps = {
  plan: BusinessPlanSections | undefined;
};

/** TOC + collapsible sections for the structured business plan. */
export function BusinessPlanViewer({ plan }: BusinessPlanViewerProps) {
  const sections = React.useMemo(() => filledBusinessPlanSections(plan), [plan]);
  const [openKeys, setOpenKeys] = React.useState<Set<string>>(() => new Set());
  const defaultOpenAppliedRef = React.useRef(false);
  const firstSectionKey = sections[0]?.key;

  // Open the first section once when content first appears — never re-apply after the
  // user collapses sections (parent polling recreates `sections` every few seconds).
  React.useEffect(() => {
    if (!firstSectionKey) {
      defaultOpenAppliedRef.current = false;
      return;
    }
    if (defaultOpenAppliedRef.current) return;
    defaultOpenAppliedRef.current = true;
    setOpenKeys(new Set([firstSectionKey]));
  }, [firstSectionKey]);

  if (!businessPlanHasContent(plan)) return null;

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const jumpTo = (anchor: string, key: string) => {
    setOpenKeys((prev) => new Set(prev).add(key));
    requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="forge-plan">
      <nav className="forge-plan-toc" aria-label="Business plan sections">
        <p className="forge-plan-toc-label">Contents</p>
        <ul className="forge-plan-toc-list">
          {sections.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                className="forge-plan-toc-link"
                onClick={() => jumpTo(s.anchor, s.key)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="forge-plan-sections">
        {sections.map((s) => {
          const open = openKeys.has(s.key);
          return (
            <section key={s.key} id={s.anchor} className="forge-plan-section">
              <button
                type="button"
                className="forge-plan-section-toggle"
                aria-expanded={open}
                aria-controls={`${s.anchor}-body`}
                onClick={() => toggle(s.key)}
              >
                <span className="forge-plan-section-chevron" aria-hidden>
                  {open ? '▾' : '▸'}
                </span>
                <span className="forge-plan-section-title">{s.label}</span>
              </button>
              {open && (
                <div id={`${s.anchor}-body`} className="forge-plan-section-body">
                  <ForgeMarkdown>{s.content}</ForgeMarkdown>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {sections.length < BUSINESS_PLAN_SECTIONS.length && (
        <p className="forge-hint forge-plan-pending">
          {BUSINESS_PLAN_SECTIONS.length - sections.length} section
          {BUSINESS_PLAN_SECTIONS.length - sections.length === 1 ? '' : 's'} still being drafted…
        </p>
      )}
    </div>
  );
}

export default BusinessPlanViewer;
