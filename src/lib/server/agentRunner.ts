import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFS, runTool } from './tools';
import { addEvent, setAgentStatus, getAgent } from '@/lib/agentStore';
import { getMetaSkillsBundle, getPromptContent } from '@/lib/forgeConfigStore';
import { applyPromptTemplate } from '@/lib/forgePrompts';
import { imageToolingStatus } from './imagePipeline';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
const MAX_ITERATIONS = 24;
const STALE_GENERATING_MS = Number(process.env.FORGE_STALE_GENERATING_MS || 12 * 60 * 1000);

const generationInFlight = new Set<string>();

export function isGenerationInFlight(slug: string): boolean {
  return generationInFlight.has(slug);
}

/** True when status is generating but no progress event for STALE_GENERATING_MS. */
export function isGenerationStale(slug: string): boolean {
  const agent = getAgent(slug);
  if (!agent || agent.status !== 'generating') return false;
  return Date.now() - agent.updatedAt > STALE_GENERATING_MS;
}

export function retryGeneration(slug: string, opts?: { force?: boolean }): { ok: boolean; error?: string } {
  const agent = getAgent(slug);
  if (!agent) return { ok: false, error: 'not found' };
  if (generationInFlight.has(slug) && !opts?.force && !isGenerationStale(slug)) {
    return { ok: false, error: 'generation already in progress' };
  }
  beginGeneration(slug, 'Retrying forge…', opts);
  return { ok: true };
}

export function startAgentGeneration(slug: string): void {
  beginGeneration(slug);
}

function beginGeneration(slug: string, startNote?: string, opts?: { force?: boolean }): void {
  void runGeneration(slug, startNote, opts).catch((err) => {
    console.error('runGeneration crashed', err);
  });
}

function buildSystemPrompt(): string {
  const tooling = imageToolingStatus();
  const visualNote = tooling.gemini
    ? 'Image generation is ONLINE (Gemini). Call generate_image three times with three DIFFERENT subject strings: icon = flat HUD glyph; emblem = ONE metal center sculpture only (backend adds full winged C&C plaque — never copy the icon subject); portrait = commander bust.'
    : 'Image generation has NO model key — images will be placeholders, but still call generate_image for all three so the cards have assets.';
  const core = applyPromptTemplate(getPromptContent('forge.system'), { visualNote });
  return `${core}${getMetaSkillsBundle()}`;
}

/** Run the full generation loop for an agent (async, fire-and-forget from the API). */
export async function runGeneration(
  slug: string,
  startNote?: string,
  opts?: { force?: boolean },
): Promise<void> {
  if (generationInFlight.has(slug) && !opts?.force) return;

  const agent = getAgent(slug);
  if (!agent) return;

  generationInFlight.add(slug);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    setAgentStatus(slug, 'error', 'ANTHROPIC_API_KEY is not set');
    addEvent(slug, 'error', 'ANTHROPIC_API_KEY missing — add it to .env.local and retry.');
    generationInFlight.delete(slug);
    return;
  }

  setAgentStatus(slug, 'generating');
  addEvent(slug, 'info', startNote ?? `Forge online · model ${MODEL}. Designing agent…`);

  // Generous per-request timeout + retries; streaming (below) keeps long skill-file
  // generations from stalling on idle connections.
  const client = new Anthropic({ apiKey, timeout: 4 * 60 * 1000, maxRetries: 2 });
  const system = buildSystemPrompt();

  const userPrompt = applyPromptTemplate(getPromptContent('forge.user_template'), {
    slug,
    businessContext: agent.businessContext,
    jobDescription:
      agent.jobDescription ||
      '(none provided — infer the role from the business context and the title hint below)',
  });

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

  try {
    let finalized = false;
    for (let i = 0; i < MAX_ITERATIONS && !finalized; i += 1) {
      // Stream + finalMessage: reliable for long (skill-file) generations.
      const resp = await client.messages
        .stream({
          model: MODEL,
          max_tokens: 8000,
          system,
          tools: TOOL_DEFS as unknown as Anthropic.Tool[],
          messages,
        })
        .finalMessage();

      messages.push({ role: 'assistant', content: resp.content });

      const toolUses = resp.content.filter(
        (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use',
      );

      if (resp.stop_reason !== 'tool_use' || toolUses.length === 0) {
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const result = await runTool(slug, tu.name, (tu.input ?? {}) as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result.content,
          is_error: result.isError,
        });
        if (tu.name === 'finalize') finalized = true;
      }

      messages.push({ role: 'user', content: toolResults });
    }

    const refreshed = getAgent(slug);
    const ok = !!refreshed && !!refreshed.data.title && !!refreshed.skillMarkdown;
    if (ok) {
      setAgentStatus(slug, 'complete');
      addEvent(slug, 'done', 'Agent forged. Command card ready.');
    } else {
      setAgentStatus(slug, 'error', 'Generation finished without a complete agent.');
      addEvent(slug, 'error', 'Generation ended early — some fields are missing.');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setAgentStatus(slug, 'error', message);
    addEvent(slug, 'error', `Forge failure: ${message}`);
  } finally {
    generationInFlight.delete(slug);
  }
}
