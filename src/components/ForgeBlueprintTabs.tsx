'use client';

import React from 'react';

export type BlueprintTabId = 'overview' | 'plan' | 'market' | 'stack' | 'team';

const TAB_ORDER: BlueprintTabId[] = ['overview', 'plan', 'market', 'stack', 'team'];

const TAB_LABELS: Record<BlueprintTabId, string> = {
  overview: 'Overview',
  plan: 'Plan',
  market: 'Market',
  stack: 'Stack',
  team: 'Team',
};

function isBlueprintTab(value: string): value is BlueprintTabId {
  return TAB_ORDER.includes(value as BlueprintTabId);
}

function hashWithoutPrefix(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hash.replace(/^#/, '');
}

export function readBlueprintTabFromHash(): BlueprintTabId {
  const hash = hashWithoutPrefix();
  if (isBlueprintTab(hash)) return hash;
  if (hash === 'plan-competitors' || hash.startsWith('plan-')) return 'plan';
  return 'overview';
}

export function writeBlueprintTabHash(tab: BlueprintTabId) {
  if (typeof window === 'undefined') return;
  const url = `${window.location.pathname}${window.location.search}#${tab}`;
  window.history.replaceState(null, '', url);
}

export function useBlueprintTab(initial: BlueprintTabId = 'overview') {
  const [tab, setTabState] = React.useState<BlueprintTabId>(initial);

  React.useEffect(() => {
    setTabState(readBlueprintTabFromHash());
    const onHashChange = () => setTabState(readBlueprintTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setTab = React.useCallback((next: BlueprintTabId) => {
    setTabState(next);
    writeBlueprintTabHash(next);
  }, []);

  return [tab, setTab] as const;
}

export function ForgeBlueprintTabBar({
  active,
  onSelect,
  roleCount,
  agentCount,
  planActive,
  marketActive,
  teamActive,
}: {
  active: BlueprintTabId;
  onSelect: (tab: BlueprintTabId) => void;
  roleCount: number;
  agentCount: number;
  planActive?: boolean;
  marketActive?: boolean;
  teamActive?: boolean;
}) {
  const badges: Partial<Record<BlueprintTabId, string | number>> = {
    team: roleCount > 0 ? roleCount : undefined,
  };

  const pulse: Partial<Record<BlueprintTabId, boolean>> = {
    plan: planActive,
    market: marketActive,
    team: teamActive,
  };

  return (
    <nav className="forge-blueprint-tabs" aria-label="Blueprint sections">
      {TAB_ORDER.map((id) => {
        const badge = badges[id];
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`forge-blueprint-panel-${id}`}
            id={`forge-blueprint-tab-${id}`}
            className={[
              'forge-blueprint-tab',
              isActive ? 'forge-blueprint-tab--active' : '',
              pulse[id] ? 'forge-blueprint-tab--pulse' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(id)}
          >
            {TAB_LABELS[id]}
            {typeof badge === 'number' && <span className="forge-blueprint-tab-badge">{badge}</span>}
            {id === 'team' && agentCount > 0 && (
              <span className="forge-blueprint-tab-meta">
                {agentCount} forged
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function ForgeBlueprintTabPanel({
  id,
  active,
  children,
}: {
  id: BlueprintTabId;
  active: BlueprintTabId;
  children: React.ReactNode;
}) {
  const isActive = active === id;
  return (
    <section
      id={`forge-blueprint-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`forge-blueprint-tab-${id}`}
      hidden={!isActive}
      className="forge-blueprint-tab-panel"
    >
      {children}
    </section>
  );
}
