'use client';

import React from 'react';
import type { AgentAppAccess } from '@/lib/businessTypes';

/** Per-agent SaaS access grid: groups capacities by app. Self-fetching. */
export function AgentAccessGrid({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const [access, setAccess] = React.useState<AgentAppAccess[] | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${slug}/access`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as { access: AgentAppAccess[] };
      setAccess(json.access);
    } catch {
      /* ignore */
    }
  }, [slug]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const nestedStyle = compact ? { paddingLeft: 22, borderLeft: '2px solid rgba(120,200,170,0.18)' } : undefined;

  if (!access) {
    return (
      <p className="forge-hint" style={nestedStyle}>
        Loading access grid…
      </p>
    );
  }
  if (access.length === 0) {
    return (
      <p className="forge-hint" style={nestedStyle}>
        No SaaS access granted yet (populated when the agent is forged under a business).
      </p>
    );
  }

  const byApp = new Map<number, { name: string; kind: string; type: string; caps: AgentAppAccess[] }>();
  for (const a of access) {
    const entry = byApp.get(a.appId) ?? {
      name: a.app?.name ?? `app ${a.appId}`,
      kind: a.app?.kind ?? '',
      type: a.appTypeKey ?? '',
      caps: [],
    };
    entry.caps.push(a);
    byApp.set(a.appId, entry);
  }

  return (
    <div style={{ display: 'grid', gap: compact ? 6 : 10, ...nestedStyle }}>
      {Array.from(byApp.values()).map((app) => (
        <div
          key={app.name}
          className={`forge-access-app-row${compact ? ' forge-access-app-row--compact' : ''}`}
        >
          <span className="forge-access-app-name">
            {app.name}
            <span className="forge-hint" style={{ marginLeft: 6, fontSize: '0.66rem' }}>
              {app.type} · {app.kind}
            </span>
          </span>
          <span className="forge-access-caps">
            {app.caps.map((c) => (
              <span
                key={c.id}
                title={c.rationale}
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(120,200,170,0.35)',
                  background: 'rgba(120,200,170,0.10)',
                  color: '#bfeede',
                }}
              >
                {c.capacityLabel ?? c.capacityKey}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
