/**
 * AI rewrite tools shared by all editable blueprint sections.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { searchWeb, webSearchProvider } from '@/lib/server/webSearch';

export function createSectionRewriteSearchTool() {
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

export function createReplaceSectionTool(onApply: (content: string, summary: string) => void) {
  return {
    replace_section_content: tool({
      description: 'Replace the entire section body with your rewritten text.',
      inputSchema: z.object({
        newContent: z.string().describe('Complete rewritten section text.'),
        summary: z.string().describe('Brief summary of what you changed and why (1-2 sentences).'),
      }),
      execute: async (input) => {
        onApply(input.newContent.trim(), input.summary);
        return 'Section updated successfully.';
      },
    }),
  };
}
