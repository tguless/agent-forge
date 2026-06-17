import Anthropic from '@anthropic-ai/sdk';
import { anthropicClientMaxRetries } from '@/lib/agent/retryPolicy';
import { getPromptContent } from '@/lib/forgeConfigStore';
import { applyPromptTemplate } from '@/lib/forgePrompts';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

export type GeneratedForgeExample = {
  businessContext: string;
  jobDescription: string;
  titleHint: string;
};

const BUILTIN_THEMES =
  'commercial real estate lease abstraction, AP invoice automation, and healthcare prior auth intake';

function buildThemeInstruction(theme?: string): string {
  const trimmed = theme?.trim();
  if (trimmed) {
    return `Theme hint from the user: ${trimmed}\nStay grounded in that domain but still invent a specific company and workflow.`;
  }
  return `Pick a creative industry and document-intelligence use case we have NOT used before. Avoid these built-in examples: ${BUILTIN_THEMES}.`;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1].trim());
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('Model did not return parseable JSON.');
  }
}

function parseExamplePayload(raw: unknown): GeneratedForgeExample {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Example payload must be a JSON object.');
  }
  const o = raw as Record<string, unknown>;
  const businessContext = String(o.businessContext ?? '').trim();
  const jobDescription = String(o.jobDescription ?? '').trim();
  const titleHint = String(o.titleHint ?? '').trim();
  if (!businessContext || !jobDescription) {
    throw new Error('Generated example missing businessContext or jobDescription.');
  }
  return {
    businessContext,
    jobDescription,
    titleHint: titleHint || 'Custom Agent',
  };
}

/** Ad-hoc forge-form example via Anthropic (configurable prompts). */
export async function generateForgeExample(theme?: string): Promise<GeneratedForgeExample> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it to .env.local.');
  }

  const client = new Anthropic({
    apiKey,
    timeout: 60_000,
    maxRetries: anthropicClientMaxRetries(),
  });
  const system = getPromptContent('forge.example.system');
  const user = applyPromptTemplate(getPromptContent('forge.example.user_template'), {
    themeInstruction: buildThemeInstruction(theme),
  });

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return parseExamplePayload(extractJsonObject(text));
}
