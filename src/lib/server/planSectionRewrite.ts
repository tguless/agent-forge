/**
 * Context assembly + shared tools for AI-assisted business plan section rewrites.
 */
import { tool } from 'ai';
import { z } from 'zod';
import type { Business } from '@/lib/businessTypes';
import {
  BUSINESS_PLAN_SECTIONS,
  filledBusinessPlanSections,
  type BusinessPlanSectionDef,
} from '@/lib/businessPlanSections';
import { searchWeb, webSearchProvider } from '@/lib/server/webSearch';

export function planSectionDef(sectionKey: string): BusinessPlanSectionDef | undefined {
  return BUSINESS_PLAN_SECTIONS.find((s) => s.key === sectionKey);
}

export function buildPlanRewriteContext(business: Business, sectionKey: string): string {
  const p = business.profile;
  const marker = (key: string) => (key === sectionKey ? ' ← [THIS IS THE SECTION TO EDIT]' : '');

  const profileBlock = [
    `# Business: ${business.name}`,
    '',
    business.description.trim(),
    '',
    p.industry ? `Industry: ${p.industry}` : '',
    p.businessModel ? `Business model: ${p.businessModel}` : '',
    p.summary ? `Summary: ${p.summary}` : '',
    p.elevatorPitch ? `Elevator pitch: ${p.elevatorPitch}` : '',
    p.valueChain?.length ? `Value chain: ${p.valueChain.join(' → ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const planBlock = filledBusinessPlanSections(p.businessPlan)
    .map(
      (s) =>
        `## ${s.label} (${s.key})${marker(s.key)}\n\n${s.content}`,
    )
    .join('\n\n---\n\n');

  const competitorBlock =
    p.competitorAnalysis?.landscape?.trim() ?
      `# Competitor landscape (summary)\n\n${p.competitorAnalysis.landscape.trim()}`
    : '';

  const market = p.marketAssessment;
  const marketBlock =
    market ?
      [
        '# Market assessment (summary)',
        market.headline ? `Headline: ${market.headline}` : '',
        market.verdict ? `Verdict: ${market.verdict}` : '',
        market.marketSize ? `Market size:\n${market.marketSize.slice(0, 1200)}` : '',
        market.recommendation ? `Recommendation:\n${market.recommendation.slice(0, 800)}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    : '';

  return [profileBlock, planBlock && `# Full business plan\n\n${planBlock}`, competitorBlock, marketBlock]
    .filter(Boolean)
    .join('\n\n---\n\n');
}

export function createPlanRewriteSearchTool() {
  return {
    tavily_search: tool({
      description:
        'Search the web (Tavily) for fresh market, competitor, pricing, or industry data. Use when the user asks for updated facts, benchmarks, or citations. Returns titles, URLs, and snippets — cite URLs in the rewritten section when relevant.',
      inputSchema: z.object({
        query: z.string().describe('Focused search query'),
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
  };
}

export function createReplacePlanSectionTool(onApply: (content: string, summary: string) => void) {
  return {
    replace_plan_section: tool({
      description: 'Replace the entire plan section body with your rewritten markdown.',
      inputSchema: z.object({
        newContent: z.string().describe('Complete rewritten section markdown (no ## heading — UI adds title).'),
        summary: z.string().describe('Brief summary of what you changed and why (1-2 sentences).'),
      }),
      execute: async (input) => {
        onApply(input.newContent.trim(), input.summary);
        return 'Plan section updated successfully.';
      },
    }),
  };
}
