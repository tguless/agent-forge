'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HudBox } from '@/components/HudBox';
import { TurnTimeline, useBusinessStream } from '@/components/TurnTimeline';

const EXAMPLE =
  'We run a boutique commercial real estate brokerage. We source listings, abstract leases, manage a deal pipeline, coordinate closings, and handle invoicing and compliance for ~30 active deals at a time.';

export default function NewBusinessPage() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [slug, setSlug] = React.useState<string | null>(null);

  const { turns, done } = useBusinessStream(slug);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Describe what the business does.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const json = (await res.json()) as { slug?: string; error?: string };
      if (!res.ok || !json.slug) throw new Error(json.error || `Server error ${res.status}`);
      setSlug(json.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start consultant');
      setSubmitting(false);
    }
  };

  return (
    <div className="ops-font-scope forge-page">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <Link href="/business" className="ops-detail-back" style={{ position: 'static' }}>
          ← All businesses
        </Link>
      </div>

      <div className="forge-wordmark forge-wordmark--lg" style={{ marginBottom: 6 }}>
        NEW<span>BUSINESS</span>
      </div>
      <p className="forge-hint">
        Describe what the business does. The consultant profiles it, recommends a SaaS + open-source
        stack (you can override later), and proposes the agent roles to forge.
      </p>

      {!slug ? (
        <form className="forge-form" onSubmit={submit}>
          <HudBox variant="rect">
            <div className="forge-field">
              <label className="forge-label" htmlFor="biz-name">
                Business name (optional)
              </label>
              <input
                id="biz-name"
                className="forge-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Harbor Lease Partners"
              />
            </div>
          </HudBox>

          <HudBox variant="rect">
            <div className="forge-field">
              <label className="forge-label" htmlFor="biz-desc">
                What does the business do? <span style={{ color: '#ff8a8a' }}>*</span>
              </label>
              <textarea
                id="biz-desc"
                className="forge-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={EXAMPLE}
              />
            </div>
          </HudBox>

          {error && <p className="forge-error">{error}</p>}

          <div className="forge-actions">
            <button type="submit" className="forge-cta" disabled={submitting}>
              {submitting ? 'Briefing consultant…' : '⚡ Run consultant'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="forge-status-line" style={{ marginBottom: 12 }}>
            {!done ? (
              <>
                <span className="forge-spinner" aria-hidden /> Consultant is building the blueprint…
              </>
            ) : (
              <>✦ Blueprint ready.</>
            )}
          </div>
          <TurnTimeline turns={turns} />
          <div className="forge-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="forge-cta"
              onClick={() => router.push(`/business/${slug}`)}
            >
              {done ? 'View blueprint →' : 'Open blueprint (live) →'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
