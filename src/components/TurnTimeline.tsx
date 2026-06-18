'use client';

import React from 'react';
import type { AgentTurnPayload } from '@/lib/agent/types';
import { ForgeLogLine } from '@/components/ForgeLogLine';

const TYPE_TICK: Record<string, string> = {
  THINKING: '✻',
  TOOL_CALL: '›',
  TOOL_RESULT: '✓',
  MESSAGE: '·',
  COMPLETE: '✦',
  ERROR: '⚠',
};

/** Renders a multi-turn ToolLoopAgent timeline (consulting or forge). */
export function TurnTimeline({ turns }: { turns: AgentTurnPayload[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [turns]);

  return (
    <div className="forge-log" ref={ref}>
      {turns.length === 0 && (
        <div className="forge-log-row">
          <span className="forge-log-tick">›</span>
          <ForgeLogLine>Connecting to agent…</ForgeLogLine>
        </div>
      )}
      {turns.map((t) => {
        const label =
          t.turnType === 'TOOL_CALL' || t.turnType === 'TOOL_RESULT'
            ? `${t.toolName ?? 'tool'} — ${t.content ?? ''}`
            : t.content ?? '';
        const dataType =
          t.turnType === 'ERROR' ? 'error' : t.turnType === 'THINKING' ? 'info' : 'tool';
        return (
          <div className="forge-log-row" data-type={dataType} key={t.id}>
            <span className="forge-log-tick">{TYPE_TICK[t.turnType] ?? '›'}</span>
            <ForgeLogLine
              style={t.turnType === 'THINKING' ? { opacity: 0.7, fontStyle: 'italic' } : undefined}
            >
              {label}
            </ForgeLogLine>
          </div>
        );
      })}
    </div>
  );
}

/** Subscribe to a business consulting SSE stream; returns live turns + status. */
export function useBusinessStream(slug: string | null) {
  const [turns, setTurns] = React.useState<AgentTurnPayload[]>([]);
  const [done, setDone] = React.useState(false);
  const seen = React.useRef<Set<number>>(new Set());

  React.useEffect(() => {
    if (!slug) return;
    setTurns([]);
    setDone(false);
    seen.current = new Set();

    const es = new EventSource(`/api/businesses/${slug}/stream`);
    es.addEventListener('turn', (ev) => {
      try {
        const turn = JSON.parse((ev as MessageEvent).data) as AgentTurnPayload;
        if (seen.current.has(turn.id)) return;
        seen.current.add(turn.id);
        setTurns((prev) => [...prev, turn]);
      } catch {
        /* ignore */
      }
    });
    es.addEventListener('done', () => {
      setDone(true);
      es.close();
    });
    es.onerror = () => {
      // The browser auto-reconnects; if the run is over the server closes again.
    };
    return () => es.close();
  }, [slug]);

  return { turns, done };
}

/** Subscribe to on-demand business-plan generation SSE. Pass `active=false` to skip. */
export function useBusinessPlanStream(slug: string | null, active = true) {
  const [turns, setTurns] = React.useState<AgentTurnPayload[]>([]);
  const [done, setDone] = React.useState(false);
  const seen = React.useRef<Set<number>>(new Set());

  React.useEffect(() => {
    if (!slug || !active) return;
    setTurns([]);
    setDone(false);
    seen.current = new Set();

    const es = new EventSource(`/api/businesses/${slug}/plan/stream`);
    es.addEventListener('turn', (ev) => {
      try {
        const turn = JSON.parse((ev as MessageEvent).data) as AgentTurnPayload;
        if (seen.current.has(turn.id)) return;
        seen.current.add(turn.id);
        setTurns((prev) => [...prev, turn]);
      } catch {
        /* ignore */
      }
    });
    es.addEventListener('done', () => {
      setDone(true);
      es.close();
    });
    es.onerror = () => {
      /* browser auto-reconnects */
    };
    return () => es.close();
  }, [slug, active]);

  return { turns, done };
}
