/**
 * Business-consulting agent tools (Vercel AI SDK `tool()` + Zod).
 * Each execute writes to SQLite via the threaded business slug.
 */
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import {
  patchBusinessProfile,
  patchBusinessPlanSection,
  addRole,
  addBusinessApp,
  setCompetitorLandscape,
  upsertCompetitor,
  setCompetitorSection,
  patchMarketAssessment,
  addMarketRisk,
  setViabilityVerdict,
  getBusiness,
} from '@/lib/businessStore';
import { BUSINESS_PLAN_SECTIONS } from '@/lib/businessPlanSections';
import { appendTextSectionVersion } from '@/lib/server/textSectionVersionHistory';
import { COMPETITOR_SECTION_KEYS } from '@/lib/competitorSections';
import {
  VIABILITY_VERDICT_KEYS,
  CONFIDENCE_LEVELS,
  RISK_SEVERITIES,
} from '@/lib/marketAssessment';
import { upsertApp, ensureCapacity, appTypeExists } from '@/lib/catalogStore';
import { searchWeb, webSearchProvider } from './webSearch';
import { generateBusinessPlaque } from './imagePipeline';
import {
  buildPlaqueBusinessContext,
  plaqueAccent,
} from '@/lib/businessPlaqueMotif';

export type BusinessToolContext = {
  businessSlug: string;
};

/** Web search + per-competitor/subsection tools for competitor analysis. */
function createCompetitorTools(ctx: BusinessToolContext): ToolSet {
  return {
    tavily_search: tool({
      description:
        'Search the web (Tavily) for competitor intelligence: rivals, pricing, positioning, reviews. Call several times with focused queries before writing the analysis. Returns titles, URLs, and snippets — cite the URLs as sources.',
      inputSchema: z.object({
        query: z.string().describe('Focused search query, e.g. "<competitor> pricing 2026"'),
        maxResults: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => {
        try {
          const results = await searchWeb(input.query, input.maxResults ?? 5);
          return {
            provider: webSearchProvider(),
            query: input.query,
            results: results.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet })),
          };
        } catch (err) {
          return {
            provider: webSearchProvider(),
            query: input.query,
            error: err instanceof Error ? err.message : String(err),
            results: [],
          };
        }
      },
    }),

    set_competitor_landscape: tool({
      description:
        'Write the competitive-landscape overview (Markdown): how many players, the main categories/segments, and where this business fits. Call once.',
      inputSchema: z.object({
        landscape: z.string().describe('Markdown overview of the competitive landscape'),
      }),
      execute: async (input) => {
        const trimmed = input.landscape.trim();
        setCompetitorLandscape(ctx.businessSlug, trimmed);
        appendTextSectionVersion(ctx.businessSlug, ['competitors', 'landscape'], {
          content: trimmed,
          source: 'agent_generated',
        });
        return 'Competitive landscape overview saved.';
      },
    }),

    upsert_competitor: tool({
      description:
        'Add or update one competitor. Call before set_competitor_section for that competitor. Returns the competitorId to use for subsections.',
      inputSchema: z.object({
        name: z.string().describe('Competitor / product name'),
        website: z.string().optional(),
        oneLiner: z.string().optional().describe('One-line summary of who they are'),
      }),
      execute: async (input) => {
        const id = upsertCompetitor(ctx.businessSlug, {
          name: input.name,
          website: input.website,
          oneLiner: input.oneLiner,
        });
        return { competitorId: id, name: input.name };
      },
    }),

    set_competitor_section: tool({
      description:
        'Fill ONE subsection of ONE competitor (Markdown body, no heading). Provide source URLs from tavily_search where possible.',
      inputSchema: z.object({
        competitorId: z.string().describe('competitorId returned by upsert_competitor (or the name)'),
        section: z
          .enum(COMPETITOR_SECTION_KEYS as [string, ...string[]])
          .describe('Which subsection to fill'),
        content: z.string().describe('Markdown body for this subsection'),
        sources: z.array(z.string()).optional().describe('Source URLs'),
      }),
      execute: async (input) => {
        const ok = setCompetitorSection(
          ctx.businessSlug,
          input.competitorId,
          input.section as (typeof COMPETITOR_SECTION_KEYS)[number],
          input.content,
          input.sources,
        );
        if (ok) {
          const trimmed = input.content.trim();
          appendTextSectionVersion(ctx.businessSlug, ['competitors', input.competitorId, input.section], {
            content: trimmed,
            source: 'agent_generated',
          });
        }
        return ok
          ? `${input.section} saved for ${input.competitorId}.`
          : `No competitor matched "${input.competitorId}" — call upsert_competitor first.`;
      },
    }),
  };
}

/**
 * Advisory market-analysis + viability-verdict tools. Uses the shared
 * tavily_search for evidence. The verdict is ALWAYS informational: it lays out
 * pros, cons, and risks so the operator can decide — it never decides for them.
 */
function createMarketAssessmentTools(ctx: BusinessToolContext): ToolSet {
  return {
    set_market_size: tool({
      description:
        'Estimate the market size for THIS business (Markdown). Give TAM, SAM, and SOM with concrete figures and show the math/assumptions. Cite source URLs from tavily_search. If data is thin, say so and give a defensible range rather than inventing precision.',
      inputSchema: z.object({
        content: z.string().describe('Markdown: TAM / SAM / SOM with figures, assumptions, and citations'),
        sources: z.array(z.string()).optional().describe('Source URLs'),
      }),
      execute: async (input) => {
        const trimmed = input.content.trim();
        patchMarketAssessment(ctx.businessSlug, {
          marketSize: trimmed,
          sources: input.sources,
        });
        appendTextSectionVersion(ctx.businessSlug, ['market', 'marketSize'], {
          content: trimmed,
          source: 'agent_generated',
        });
        return 'Market size saved.';
      },
    }),

    set_demand_signals: tool({
      description:
        'Summarize real-world DEMAND evidence (Markdown): search/interest trends, hiring, funding flowing to the space, customer willingness to pay, complaints about incumbents. Distinguish strong signals from weak ones. Cite sources.',
      inputSchema: z.object({
        content: z.string().describe('Markdown: demand signals, graded strong vs weak, with citations'),
        sources: z.array(z.string()).optional().describe('Source URLs'),
      }),
      execute: async (input) => {
        const trimmed = input.content.trim();
        patchMarketAssessment(ctx.businessSlug, {
          demandSignals: trimmed,
          sources: input.sources,
        });
        appendTextSectionVersion(ctx.businessSlug, ['market', 'demandSignals'], {
          content: trimmed,
          source: 'agent_generated',
        });
        return 'Demand signals saved.';
      },
    }),

    set_market_timing: tool({
      description:
        'Assess TIMING / "why now" (Markdown): tailwinds, headwinds, regulatory or technology shifts, and whether the window is opening or closing. Cite sources.',
      inputSchema: z.object({
        content: z.string().describe('Markdown: timing, trends, tailwinds and headwinds, with citations'),
        sources: z.array(z.string()).optional().describe('Source URLs'),
      }),
      execute: async (input) => {
        const trimmed = input.content.trim();
        patchMarketAssessment(ctx.businessSlug, {
          timing: trimmed,
          sources: input.sources,
        });
        appendTextSectionVersion(ctx.businessSlug, ['market', 'timing'], {
          content: trimmed,
          source: 'agent_generated',
        });
        return 'Market timing saved.';
      },
    }),

    add_market_risk: tool({
      description:
        'Record ONE concrete risk of pursuing this business, with a severity, optional likelihood, and a concrete mitigation or what to validate first. Call multiple times (aim for 3–6 distinct risks).',
      inputSchema: z.object({
        risk: z.string().describe('The risk, stated plainly'),
        severity: z.enum(RISK_SEVERITIES as [string, ...string[]]),
        likelihood: z.enum(RISK_SEVERITIES as [string, ...string[]]).optional(),
        mitigation: z.string().optional().describe('Concrete mitigation or cheap way to de-risk'),
      }),
      execute: async (input) => {
        addMarketRisk(ctx.businessSlug, {
          risk: input.risk.trim(),
          severity: input.severity as (typeof RISK_SEVERITIES)[number],
          likelihood: input.likelihood as (typeof RISK_SEVERITIES)[number] | undefined,
          mitigation: input.mitigation?.trim(),
        });
        return `Risk recorded (${input.severity}).`;
      },
    }),

    set_viability_verdict: tool({
      description:
        'Record the ADVISORY go/no-go verdict. This is informational only — it must lay out pros and cons honestly and frame the decision as the operator\'s, never as a directive. Call once, after market size, demand, timing, and the risks are recorded.',
      inputSchema: z.object({
        verdict: z
          .enum(VIABILITY_VERDICT_KEYS as [string, ...string[]])
          .describe(
            'pursue | pursue-conditional | mixed | high-risk | reconsider (most → least favorable)',
          ),
        confidence: z
          .enum(CONFIDENCE_LEVELS as [string, ...string[]])
          .optional()
          .describe('How confident the assessment is given evidence quality'),
        headline: z.string().describe('One-line honest read of the opportunity'),
        pros: z.array(z.string()).describe('Reasons it could work (3+)'),
        cons: z.array(z.string()).describe('Reasons it might not (3+)'),
        recommendation: z
          .string()
          .describe(
            'Markdown closing read. Be direct about whether the evidence leans for or against, but explicitly state the final call is the operator\'s — do not decide for them.',
          ),
      }),
      execute: async (input) => {
        setViabilityVerdict(ctx.businessSlug, {
          verdict: input.verdict as (typeof VIABILITY_VERDICT_KEYS)[number],
          confidence: input.confidence as (typeof CONFIDENCE_LEVELS)[number] | undefined,
          headline: input.headline,
          pros: input.pros,
          cons: input.cons,
          recommendation: input.recommendation,
        });
        const slug = ctx.businessSlug;
        appendTextSectionVersion(slug, ['market', 'headline'], {
          content: input.headline.trim(),
          source: 'agent_generated',
        });
        appendTextSectionVersion(slug, ['market', 'pros'], {
          content: input.pros.map((p) => `- ${p}`).join('\n'),
          source: 'agent_generated',
        });
        appendTextSectionVersion(slug, ['market', 'cons'], {
          content: input.cons.map((c) => `- ${c}`).join('\n'),
          source: 'agent_generated',
        });
        appendTextSectionVersion(slug, ['market', 'recommendation'], {
          content: input.recommendation.trim(),
          source: 'agent_generated',
        });
        return `Viability verdict saved: ${input.verdict}.`;
      },
    }),
  };
}

function createPlanSectionTools(ctx: BusinessToolContext): ToolSet {
  const tools: ToolSet = {};
  for (const section of BUSINESS_PLAN_SECTIONS) {
    tools[section.toolName] = tool({
      description: section.toolDescription,
      inputSchema: z.object({
        content: z
          .string()
          .describe('Markdown body for this section only — no ## heading (the UI adds the title)'),
      }),
      execute: async (input) => {
        const trimmed = input.content.trim();
        patchBusinessPlanSection(ctx.businessSlug, section.key, trimmed);
        appendTextSectionVersion(ctx.businessSlug, ['plan', section.key], {
          content: trimmed,
          source: 'agent_generated',
        });
        return `${section.label} saved.`;
      },
    });
  }
  return tools;
}

export function createBusinessTools(ctx: BusinessToolContext): ToolSet {
  return {
    set_business_profile: tool({
      description:
        'Capture the business profile. Call once near the start. valueChain is 4–7 ordered stages from input to delivered value.',
      inputSchema: z.object({
        industry: z.string().describe('Sector in plain language'),
        businessModel: z.string().describe('How the business makes money'),
        summary: z.string().describe('2–3 sentence operator-grade summary'),
        valueChain: z.array(z.string()).optional().describe('Ordered value-chain stages'),
      }),
      execute: async (input) => {
        patchBusinessProfile(ctx.businessSlug, {
          industry: input.industry,
          businessModel: input.businessModel,
          summary: input.summary,
          valueChain: input.valueChain ?? [],
        });
        const slug = ctx.businessSlug;
        appendTextSectionVersion(slug, ['profile', 'industry'], {
          content: input.industry.trim(),
          source: 'agent_generated',
        });
        appendTextSectionVersion(slug, ['profile', 'businessModel'], {
          content: input.businessModel.trim(),
          source: 'agent_generated',
        });
        appendTextSectionVersion(slug, ['profile', 'summary'], {
          content: input.summary.trim(),
          source: 'agent_generated',
        });
        if (input.valueChain?.length) {
          appendTextSectionVersion(slug, ['profile', 'valueChain'], {
            content: input.valueChain.join('\n'),
            source: 'agent_generated',
          });
        }
        return `Profile saved: ${input.industry} · ${input.businessModel}.`;
      },
    }),

    set_elevator_pitch: tool({
      description:
        'Write the elevator pitch. One paragraph, 30–45 seconds when spoken (~50–90 words): hook → problem → solution → differentiation → outcome or ask.',
      inputSchema: z.object({
        pitch: z.string().describe('Spoken elevator pitch, no bullet lists'),
      }),
      execute: async (input) => {
        const trimmed = input.pitch.trim();
        patchBusinessProfile(ctx.businessSlug, { elevatorPitch: trimmed });
        appendTextSectionVersion(ctx.businessSlug, ['profile', 'elevatorPitch'], {
          content: trimmed,
          source: 'agent_generated',
        });
        return 'Elevator pitch saved.';
      },
    }),

    ...createPlanSectionTools(ctx),
    ...createCompetitorTools(ctx),
    ...createMarketAssessmentTools(ctx),

    recommend_app: tool({
      description:
        'Recommend one app for an app TYPE. Mark isDefault=true for the single best pick per type; add alternatives with isDefault=false. Offer both a SaaS and an OSS option per type where possible.',
      inputSchema: z.object({
        appType: z.string().describe('App type key, e.g. crm, accounting, esign, storage, email'),
        name: z.string(),
        kind: z.enum(['saas', 'oss']),
        website: z.string().optional(),
        description: z.string().optional(),
        isDefault: z.boolean().optional(),
        rationale: z.string().optional(),
      }),
      execute: async (input) => {
        const newType = !appTypeExists(input.appType);
        const app = upsertApp({
          name: input.name,
          appTypeKey: input.appType,
          kind: input.kind,
          website: input.website,
          description: input.description,
        });
        addBusinessApp({
          businessSlug: ctx.businessSlug,
          appId: app.id,
          appTypeKey: app.appTypeKey,
          isDefault: input.isDefault,
          rationale: input.rationale,
        });
        return `${input.isDefault ? 'Default' : 'Alternative'} for ${app.appTypeKey}: ${app.name} (${input.kind})${newType ? ' [new type]' : ''}.`;
      },
    }),

    generate_plaque: tool({
      description:
        'Generate the riveted business identity plaque (Gemini). Call once after set_business_profile. Pass subject = ONE short HUD glyph phrase (10–25 words): [artifact] + [action] — HUD line icon. Example for patent research: "magnifying glass over fanned patent pages with claim lines — HUD line icon". Never paste the business description; never generic circuit-book or database icons.',
      inputSchema: z.object({
        subject: z
          .string()
          .describe('Short HUD glyph phrase, 10–25 words — concrete workflow artifact for this business'),
        accent: z
          .string()
          .optional()
          .describe('Hex accent color, e.g. #8ee85a — omit to use a stable default for this business'),
      }),
      execute: async (input) => {
        const business = getBusiness(ctx.businessSlug);
        if (!business) return { error: 'Business not found' };
        const accent = input.accent?.trim() || plaqueAccent(business.slug);
        const result = await generateBusinessPlaque({
          slug: ctx.businessSlug,
          subject: input.subject.trim(),
          accent,
          businessName: business.name,
          businessContext: buildPlaqueBusinessContext(business),
        });
        patchBusinessProfile(ctx.businessSlug, {
          plaquePath: result.webPath,
          plaqueSubject: input.subject.trim(),
        });
        return {
          webPath: result.webPath,
          generated: result.generated,
          notes: result.notes,
        };
      },
    }),

    suggest_role: tool({
      description:
        'Suggest one agent role to run the business. Each role is a forge prompt (businessContext + jobDescription). authorityHint: 3=IC, 4=leader, 5=executive.',
      inputSchema: z.object({
        title: z.string().describe('Role title, e.g. "AP Automation Agent"'),
        businessContext: z.string().describe('2–3 sentences framing the business for this role'),
        jobDescription: z.string().describe('Recurring tasks, escalation bar, artifacts produced'),
        authorityHint: z.number().int().min(3).max(5).optional(),
        rationale: z.string().optional(),
      }),
      execute: async (input) => {
        const role = addRole({
          businessSlug: ctx.businessSlug,
          title: input.title,
          businessContext: input.businessContext,
          jobDescription: input.jobDescription,
          authorityHint: input.authorityHint,
          rationale: input.rationale,
        });
        appendTextSectionVersion(ctx.businessSlug, ['roles', String(role.id), 'jobDescription'], {
          content: input.jobDescription.trim(),
          source: 'agent_generated',
        });
        appendTextSectionVersion(ctx.businessSlug, ['roles', String(role.id), 'businessContext'], {
          content: input.businessContext.trim(),
          source: 'agent_generated',
        });
        return `Role suggested: ${role.title} (authority ${role.authorityHint}).`;
      },
    }),

    define_capacity: tool({
      description:
        'OPTIONAL: add a new access capacity to the controlled vocabulary when no existing capacity fits. appTypes lists which app types it applies to.',
      inputSchema: z.object({
        key: z.string().describe('snake_case key, e.g. "reconcile"'),
        label: z.string(),
        description: z.string().optional(),
        appTypes: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        const cap = ensureCapacity({
          key: input.key,
          label: input.label,
          description: input.description,
          appTypeKeys: input.appTypes,
        });
        return `Capacity ensured: ${cap.key} (${cap.label}).`;
      },
    }),

    finalize_blueprint: tool({
      description:
        'Call once after the profile, elevator pitch, all eight business-plan sections, app stack, and roles are recorded. Marks the blueprint complete.',
      inputSchema: z.object({}),
      execute: async () => ({ completed: true }),
    }),
  };
}

/** Plan-only tools for on-demand business plan generation on existing blueprints. */
export function createBusinessPlanTools(ctx: BusinessToolContext): ToolSet {
  return {
    ...createPlanSectionTools(ctx),
    ...createCompetitorTools(ctx),
    finalize_plan: tool({
      description:
        'Call once all eight plan sections are saved and the competitor analysis (landscape + competitors) is recorded.',
      inputSchema: z.object({}),
      execute: async () => ({ completed: true }),
    }),
  };
}

/**
 * Market-assessment-only tools for the on-demand viability run on an existing
 * blueprint. Shares tavily_search for evidence-gathering.
 */
export function createMarketAssessmentRunTools(ctx: BusinessToolContext): ToolSet {
  return {
    tavily_search: tool({
      description:
        'Search the web (Tavily) for market evidence: market-size reports, demand/interest trends, funding, hiring, customer complaints. Call several times with focused queries before writing the assessment. Returns titles, URLs, and snippets — cite the URLs.',
      inputSchema: z.object({
        query: z.string().describe('Focused search query, e.g. "<market> market size 2026"'),
        maxResults: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => {
        try {
          const results = await searchWeb(input.query, input.maxResults ?? 5);
          return {
            provider: webSearchProvider(),
            query: input.query,
            results: results.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet })),
          };
        } catch (err) {
          return {
            provider: webSearchProvider(),
            query: input.query,
            error: err instanceof Error ? err.message : String(err),
            results: [],
          };
        }
      },
    }),
    ...createMarketAssessmentTools(ctx),
    finalize_market_assessment: tool({
      description:
        'Call once the market size, demand signals, timing, risks, and the advisory viability verdict are all recorded.',
      inputSchema: z.object({}),
      execute: async () => ({ completed: true }),
    }),
  };
}
