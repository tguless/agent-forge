/**
 * Web search for competitor research. Tavily-first (method + key shared with the
 * debate-fact-checker project), with Serper and DuckDuckGo Instant fallbacks so
 * the agent degrades gracefully when no key is set.
 *
 * Ported from terraform/debate-fact-checker/web/src/lib/agent/web-search.ts.
 */

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export function webSearchProvider(): 'tavily' | 'serper' | 'duckduckgo' {
  if (process.env.TAVILY_API_KEY) return 'tavily';
  if (process.env.SERPER_API_KEY) return 'serper';
  return 'duckduckgo';
}

export async function searchWeb(query: string, maxResults = 5): Promise<SearchResult[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) return searchTavily(query, maxResults, tavilyKey);

  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) return searchSerper(query, maxResults, serperKey);

  return searchDuckDuckGoInstant(query, maxResults);
}

async function searchTavily(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error(`Tavily search failed: ${response.status}`);

  const data = (await response.json()) as {
    results?: Array<{ title: string; url: string; content: string }>;
  };

  return (data.results ?? []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.content,
  }));
}

async function searchSerper(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({ q: query, num: maxResults }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error(`Serper search failed: ${response.status}`);

  const data = (await response.json()) as {
    organic?: Array<{ title: string; link: string; snippet: string }>;
  };

  return (data.organic ?? []).map((item) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet,
  }));
}

async function searchDuckDuckGoInstant(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`DuckDuckGo search failed: ${response.status}`);

  const data = (await response.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: Array<
      | { Text?: string; FirstURL?: string }
      | { Topics?: Array<{ Text?: string; FirstURL?: string }> }
    >;
  };

  const results: SearchResult[] = [];

  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.Heading ?? 'Summary',
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }

  for (const topic of data.RelatedTopics ?? []) {
    if (results.length >= maxResults) break;
    if ('Topics' in topic && topic.Topics) {
      for (const sub of topic.Topics) {
        if (sub.Text && sub.FirstURL) {
          results.push({ title: sub.Text.slice(0, 80), url: sub.FirstURL, snippet: sub.Text });
        }
      }
    } else if ('Text' in topic && topic.Text && topic.FirstURL) {
      results.push({ title: topic.Text.slice(0, 80), url: topic.FirstURL, snippet: topic.Text });
    }
  }

  if (results.length === 0) {
    return [
      {
        title: 'No instant results',
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet:
          'DuckDuckGo instant API returned no results. Set TAVILY_API_KEY or SERPER_API_KEY for richer search.',
      },
    ];
  }

  return results.slice(0, maxResults);
}
