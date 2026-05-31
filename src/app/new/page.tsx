'use client';

import React from 'react';
import Link from 'next/link';
import { HudBox } from '@/components/HudBox';
import type { AgentStatus, GenerationEvent } from '@/lib/types';

const EXAMPLE_BUSINESS =
  'We run a mid-market commercial real estate firm. Our analysts spend hours abstracting key terms out of lease PDFs (rent schedules, options, CAM, escalations) into spreadsheets for asset managers.';
const EXAMPLE_JD =
  'Lease Abstraction Specialist — read incoming lease documents, extract critical dates and financial terms into our system of record, flag risky clauses, and keep the abstract database accurate and audit-ready.';

export default function NewAgentPage() {
  const [businessContext, setBusinessContext] = React.useState('');
  const [jobDescription, setJobDescription] = React.useState('');
  const [titleHint, setTitleHint] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [slug, setSlug] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<AgentStatus | null>(null);
  const [events, setEvents] = React.useState<GenerationEvent[]>([]);
  const lastId = React.useRef(0);
  const logRef = React.useRef<HTMLDivElement>(null);

  // Poll generation events once a slug exists.
  React.useEffect(() => {
    if (!slug) return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/agents/${slug}/events?after=${lastId.current}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          status: AgentStatus;
          error: string | null;
          events: GenerationEvent[];
        };
        if (!active) return;
        if (json.events.length) {
          lastId.current = json.events[json.events.length - 1].id;
          setEvents((prev) => [...prev, ...json.events]);
        }
        setStatus(json.status);
        if (json.status === 'complete' || json.status === 'error') {
          clearInterval(timer);
        }
      } catch {
        /* keep polling */
      }
    };
    const timer = setInterval(tick, 1500);
    void tick();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [slug]);

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [events]);

  const postGenerate = async (): Promise<{ slug: string }> => {
    const res = await fetch('/api/agents/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ businessContext, jobDescription, titleHint }),
    });
    // Read as text first so an empty/non-JSON body (e.g. dev cold-start) gives a clear error.
    const text = await res.text();
    let json: { slug?: string; error?: string } | null = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON body */
      }
    }
    if (!res.ok) {
      throw new Error(json?.error || `Server error ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`);
    }
    if (!json?.slug) {
      throw new Error('Empty response from the server — it may still be starting up.');
    }
    return { slug: json.slug };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessContext.trim()) {
      setError('Business context is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let json: { slug: string };
      try {
        json = await postGenerate();
      } catch (firstErr) {
        // The dev server compiles API routes on first hit; one transient failure is
        // expected on a cold start. Wait briefly and retry once before surfacing an error.
        await new Promise((r) => setTimeout(r, 1500));
        try {
          json = await postGenerate();
        } catch {
          throw firstErr;
        }
      }
      setSlug(json.slug);
      setStatus('queued');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation');
    } finally {
      setSubmitting(false);
    }
  };

  const useExample = () => {
    setBusinessContext(EXAMPLE_BUSINESS);
    setJobDescription(EXAMPLE_JD);
    setTitleHint('Lease Abstraction Agent');
  };

  const running = status === 'queued' || status === 'generating';

  return (
    <div className="ops-font-scope forge-page">
      <Link href="/" className="ops-detail-back" style={{ position: 'static', marginBottom: 18 }}>
        ← All agents
      </Link>

      <div className="forge-wordmark forge-wordmark--lg" style={{ marginBottom: 6 }}>
        AGENT<span>FORGE</span>
      </div>
      <p className="forge-hint">
        Give a minimal business description and a job description. The Forge designs a full tactical
        command card, a detailed skill file, and visual identity.
      </p>

      {!slug ? (
        <form className="forge-form" onSubmit={submit}>
          <HudBox variant="rect">
            <div className="forge-field">
              <label className="forge-label" htmlFor="biz">
                What does the business do? <span style={{ color: '#ff8a8a' }}>*</span>
              </label>
              <textarea
                id="biz"
                className="forge-textarea"
                value={businessContext}
                onChange={(e) => setBusinessContext(e.target.value)}
                placeholder={EXAMPLE_BUSINESS}
              />
            </div>
          </HudBox>

          <HudBox variant="rect">
            <div className="forge-field">
              <label className="forge-label" htmlFor="jd">
                Job description / role
              </label>
              <textarea
                id="jd"
                className="forge-textarea"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder={EXAMPLE_JD}
              />
            </div>
          </HudBox>

          <HudBox variant="rect">
            <div className="forge-field">
              <label className="forge-label" htmlFor="title">
                Agent name hint (optional)
              </label>
              <input
                id="title"
                className="forge-input"
                value={titleHint}
                onChange={(e) => setTitleHint(e.target.value)}
                placeholder="e.g. Lease Abstraction Agent"
              />
            </div>
          </HudBox>

          {error && <p className="forge-error">{error}</p>}

          <div className="forge-actions">
            <button type="submit" className="forge-cta" disabled={submitting}>
              {submitting ? 'Igniting forge…' : '⚡ Forge agent'}
            </button>
            <button type="button" className="forge-cta forge-cta--ghost" onClick={useExample}>
              Use example
            </button>
          </div>
        </form>
      ) : (
        <div className="forge-progress">
          <div className="forge-status-line">
            {running && <span className="forge-spinner" aria-hidden />}
            {status === 'complete'
              ? '✓ Agent forged'
              : status === 'error'
                ? '⚠ Forge failed'
                : 'Forging agent…'}
          </div>

          <div className="forge-log" ref={logRef}>
            {events.length === 0 && <div className="forge-log-row">Connecting to forge…</div>}
            {events.map((ev) => (
              <div className="forge-log-row" data-type={ev.type} key={ev.id}>
                <span className="forge-log-tick">›</span>
                <span>{ev.message}</span>
              </div>
            ))}
          </div>

          <div className="forge-actions">
            {status === 'complete' && (
              <Link href={`/agent/${slug}`} className="forge-cta">
                View command card →
              </Link>
            )}
            <Link href={`/agent/${slug}`} className="forge-cta forge-cta--ghost">
              Open card (live)
            </Link>
            <Link href="/" className="forge-cta forge-cta--ghost">
              All agents
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
