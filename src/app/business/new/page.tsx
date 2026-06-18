'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HudBox } from '@/components/HudBox';
import { ForgeBackBusinesses } from '@/components/ForgeBackButton';
import { TurnTimeline, useBusinessStream } from '@/components/TurnTimeline';

const EXAMPLE =
  'We run a boutique commercial real estate brokerage. We source listings, abstract leases, manage a deal pipeline, coordinate closings, and handle invoicing and compliance for ~30 active deals at a time.';

type Sample = { label: string; name: string; description: string };

const SAMPLES: Sample[] = [
  {
    label: 'Patent Researcher',
    name: 'Patent Researcher',
    description:
      "We run Patent Researcher (patent.paperiq.ai), a multi-tenant SaaS that uses agentic, multi-turn AI to perform patent prior-art and viability research for inventors, IP attorneys, and R&D teams. A user submits a text query or uploads an invention disclosure or draft filing, and our research agent runs a live multi-turn loop — every step streamed to a real-time activity feed — calling patent MCP tools to ingest USPTO data (PPUBS patents and applications) and to run hybrid vector-plus-keyword semantic search over embedded patent-text chunks stored in Qdrant. It ranks candidate prior art with a 0–100 relevancy score, a written justification, and category tags (novelty-risk, same-field, blocking-art), then produces an agent research summary covering novelty risk, obviousness risk, and concrete claim-narrowing recommendations (informational only, not legal advice). Tenant workspaces support owner/admin/member roles with invite-by-email and a cross-tenant super-admin view. Stack: Next.js 15 / React 19, Drizzle ORM on PostgreSQL, NextAuth, OpenAI + Anthropic models for the agent loop and embeddings, AWS S3 for uploads, deployed via Docker behind CloudFront.",
  },
  {
    label: 'Eyesense.ai',
    name: 'Eyesense.ai',
    description:
      "We run Eyesense.ai, a computer-vision monitoring platform for property and perimeter security; our flagship product is DeerAlarm. We connect to a customer's existing IP/RTSP cameras through a small home gateway that dials OUT over a WireGuard VPN tunnel to our cloud hub — so no inbound ports are ever opened on the customer's network. We run object detection (on-device at the edge and in the cloud) to spot deer, wildlife, people, and vehicles, then send real-time alerts by push, SMS, and email with annotated snapshots, so homeowners, farms, and small businesses can deter intruders and protect gardens and crops without paying for a monitoring contract. The hub is built from Spring Boot services (a management service on JDBC/Liquibase plus a reactive R2DBC gateway that proxies browser and API traffic through the VPN to each gateway) and a React SPA frontend, running on AWS ECS Fargate (ARM64) with a WireGuard EC2 relay, a shared RDS PostgreSQL instance (isolated deeralarm schema), and Valkey/Redis caching. We monetize with Stripe subscription tiers (starting with a Basic plan) while keeping infrastructure lean at roughly $20/month per hub.",
  },
  {
    label: 'PaperIQ',
    name: 'PaperIQ',
    description:
      "We run PaperIQ.ai — \"Structured Intelligence from Documents and Voice.\" We are a multi-tenant B2B SaaS that turns PDFs, scanned documents, and call/voice recordings into structured, schema-validated data and pushes it into our customers' systems via MCP, instead of trapping it in PDFs or generic AI summaries. Our extraction pipeline runs in phases: page-image vision analysis, then template- and schema-driven extraction against a customer's bring-your-own JSON Schema with real-time validation during generation, then MCP tool execution into CRMs, ERPs, and databases. We provide RAG chat over each tenant's processed corpus with grounded citations and a groundedness/hallucination check, plus pgvector semantic search exposed as tenant-isolated MCP tools. Customers bring their own model keys — we support local Ollama (qwen2.5-vl vision), OpenAI, Anthropic Claude, Google, and AWS Bedrock. The backend is Spring Boot 3 + Spring AI + Spring Security (JWT, OAuth 2.1, PKCE) on PostgreSQL/Liquibase with MinIO object storage; the frontend is React/Next.js. We serve operations, compliance, finance, and engineering teams in document-heavy, regulated industries with strict tenant isolation. Pricing is free to start (no credit card), then usage-based page credits, Pay-Per-Page packs, and subscription tiers.",
  },
  {
    label: 'Debate-Fact-Checker',
    name: 'Debate Fact Checker',
    description:
      "We run a YouTube video fact-checking service (debate.paperiq.ai). A user pastes a video link; we pull the transcript and an agentic, multi-turn AI — a ToolLoopAgent built on the Vercel AI SDK running OpenAI's gpt-5-mini — drives the whole verification rather than a hardcoded pipeline. The agent detects distinct factual claims and rhetorical techniques, and for each claim runs live web search (Tavily first, with Serper and DuckDuckGo fallbacks) to gather and read credible sources, with every reasoning step, tool call, and tool result streamed to the UI as a live turn timeline over SSE. The output is a structured report that rates each claim supported / disputed / unverifiable with citations, alongside a rhetoric analysis of the speaker's persuasion techniques. Audiences include journalists, educators, debate coaches, and curious viewers who want sourced fact-checks of long-form video. It is a Next.js app with a Postgres-backed turn/history store, deployed on our home server behind CloudFront.",
  },
  {
    label: 'Crank Automotive',
    name: 'Crank Automotive Co.',
    description:
      'We are launching Crank Automotive Co. to reintroduce a new passenger vehicle that starts with a hand crank — no push-button ignition, no key fob, no always-on electronics. The flagship model, the Model C-1, targets nostalgia enthusiasts, mechanical purists, off-grid homesteaders, and collectors who want a modern chassis (disc brakes, seat belts, fuel injection for emissions compliance) paired with a deliberate, pre-digital starting ritual. Buyers configure trim and paint online; we assemble in small batches at a regional micro-factory and sell direct-to-consumer with a limited warranty. Revenue comes from vehicle sales ($42K–$58K ASP), optional hand-crank upgrade kits for classic restorations, and annual maintenance plans. We market through car shows, YouTube restoration channels, and enthusiast forums. Stack: Shopify Plus for configurators and deposits, a lightweight Next.js marketing site, NetSuite for order-to-build, and a React factory tablet app for work orders. We believe crank-start cars are an underserved counter-trend to EV ubiquity and “software-defined vehicle” complexity — a physical, tactile alternative for people who want to own a machine, not a computer on wheels.',
  },
];

export default function NewBusinessPage() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [slug, setSlug] = React.useState<string | null>(null);

  const { turns, done } = useBusinessStream(slug);

  const loadSample = (sample: Sample) => {
    setName(sample.name);
    setDescription(sample.description);
    setError(null);
  };

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
        <ForgeBackBusinesses style={{ position: 'static' }} />
      </div>

      <div className="forge-wordmark forge-wordmark--lg" style={{ marginBottom: 6 }}>
        NEW<span>BUSINESS</span>
      </div>
      <p className="forge-hint">
        Describe what the business does. The consultant profiles it, writes an elevator pitch and business plan,
        researches the competitive landscape with live web search, drafts an advisory market assessment (sized market,
        demand, pros/cons, risks, and a go/no-go read — it informs you; it does not decide for you), recommends a
        SaaS + open-source stack (you can override later), and proposes the agent roles to forge.
      </p>

      {!slug ? (
        <form className="forge-form" onSubmit={submit}>
          <div className="forge-sample-row">
            <span className="forge-hint forge-sample-label">Load sample:</span>
            {SAMPLES.map((sample, i) => (
              <button
                key={sample.label}
                type="button"
                className="forge-sample-btn"
                onClick={() => loadSample(sample)}
                title={sample.description}
              >
                {i + 1}. {sample.label}
              </button>
            ))}
          </div>

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
