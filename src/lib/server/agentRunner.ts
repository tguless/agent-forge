import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFS, runTool } from './tools';
import { addEvent, setAgentStatus, getAgent } from '@/lib/agentStore';
import { imageToolingStatus } from './imagePipeline';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
const MAX_ITERATIONS = 24;

function loadSkills(): string {
  const dir = path.join(process.cwd(), 'skills');
  let out = '';
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
    for (const f of files) {
      out += `\n\n===== ${f} =====\n${fs.readFileSync(path.join(dir, f), 'utf8')}`;
    }
  } catch {
    /* skills optional */
  }
  return out;
}

function buildSystemPrompt(): string {
  const tooling = imageToolingStatus();
  const visualNote = tooling.gemini
    ? 'Image generation is ONLINE (Gemini). Generate all three images.'
    : 'Image generation has NO model key — images will be placeholders, but still call generate_image for all three so the cards have assets.';
  return `You are the Forge — an autonomous agent that designs a single tactical "command-card" AI agent for a business.

You are given a business description and a job description. Using the skills below, produce a complete, specific, operator-grade agent: identity, narrative, lists, metrics, a detailed Markdown skill file, and three visual assets. Use the provided tools to record every part. Do not ask the user questions — make strong, specific decisions grounded in the inputs.

${visualNote}

Follow this exact sequence of tool calls:
1) set_identity
2) generate_image (emblem)  3) generate_image (portrait)  4) generate_image (icon)
5) set_narrative  6) set_lists  7) set_metrics
8) write_skill_file
9) finalize

IMPORTANT: generate the three images RIGHT AFTER set_identity (before the long skill file) so the
visual identity appears quickly. Call tools one logical step at a time. After finalize, stop.

${loadSkills()}`;
}

/** Run the full generation loop for an agent (async, fire-and-forget from the API). */
export async function runGeneration(slug: string): Promise<void> {
  const agent = getAgent(slug);
  if (!agent) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    setAgentStatus(slug, 'error', 'ANTHROPIC_API_KEY is not set');
    addEvent(slug, 'error', 'ANTHROPIC_API_KEY missing — add it to .env.local and retry.');
    return;
  }

  setAgentStatus(slug, 'generating');
  addEvent(slug, 'info', `Forge online · model ${MODEL}. Designing agent…`);

  // Generous per-request timeout + retries; streaming (below) keeps long skill-file
  // generations from stalling on idle connections.
  const client = new Anthropic({ apiKey, timeout: 4 * 60 * 1000, maxRetries: 2 });
  const system = buildSystemPrompt();

  const userPrompt = `Slug for this agent: ${slug}

BUSINESS CONTEXT:
${agent.businessContext}

JOB DESCRIPTION:
${agent.jobDescription || '(none provided — infer the role from the business context and the title hint below)'}

Design the agent now.`;

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
  }
}
