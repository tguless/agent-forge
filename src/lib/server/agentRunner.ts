/**
 * Forge agent generation loop — migrated to the shared ToolLoopAgent runtime.
 * Runs in the background and persists both the agent_turns timeline (new) and
 * generation_events (legacy polling UI). When the agent belongs to a business,
 * the business's selected app stack is injected so the agent can populate its
 * SaaS access grid via set_app_access.
 */
import { runToolLoop } from '@/lib/agent/runtime';
import { registerRun } from '@/lib/agent/runRegistry';
import { addEvent, setAgentStatus, getAgent } from '@/lib/agentStore';
import { getAgentBusinessSlug, selectedBusinessApps } from '@/lib/businessStore';
import { capacityKeysForAppType } from '@/lib/catalogStore';
import { getMetaSkillsBundle, getPromptContent } from '@/lib/forgeConfigStore';
import { applyPromptTemplate } from '@/lib/forgePrompts';
import { createForgeTools } from './forgeTools';
import { imageToolingStatus } from './imagePipeline';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
const STALE_GENERATING_MS = Number(process.env.FORGE_STALE_GENERATING_MS || 45 * 60 * 1000);

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

/** Build the SELECTED APP STACK block for a business, or null if none/empty. */
function buildAppStackBlock(businessSlug: string | null): string | null {
  if (!businessSlug) return null;
  const stack = selectedBusinessApps(businessSlug);
  if (stack.length === 0) return null;
  return stack
    .map((b) => {
      const caps = capacityKeysForAppType(b.appTypeKey).join(', ');
      return `- ${b.app.name} (slug: ${b.app.slug}, type: ${b.appTypeKey}, ${b.app.kind}) — valid capacities: ${caps}`;
    })
    .join('\n');
}

function buildSystemPrompt(appStackBlock: string | null): string {
  const tooling = imageToolingStatus();
  const visualNote = tooling.gemini
    ? 'Image generation is ONLINE (Gemini). Call generate_image three times with three DIFFERENT subject strings: icon = flat HUD glyph; emblem = ONE metal center sculpture only (backend adds full winged C&C plaque — never copy the icon subject); portrait = commander bust.'
    : 'Image generation has NO model key — images will be placeholders, but still call generate_image for all three so the cards have assets.';
  const core = applyPromptTemplate(getPromptContent('forge.system'), { visualNote });
  let system = `${core}${getMetaSkillsBundle()}`;

  if (appStackBlock) {
    system +=
      `\n\n===== app-access skill =====\n${getPromptContent('skills.app_access')}` +
      `\n\n========================================\n` +
      `MANDATORY EXTRA STEP — THIS AGENT BELONGS TO A BUSINESS.\n` +
      `Your tool sequence is AMENDED: you MUST call set_app_access exactly once, after set_metrics and BEFORE write_skill_file.\n` +
      `Do NOT call finalize until set_app_access has been called. An agent without an access grid is incomplete.\n` +
      `Grant LEAST-PRIVILEGE access only to the apps this role actually touches (typically 2–5 of the apps below), each at a valid capacity for that app's type.\n` +
      `You may ONLY grant access to apps in this stack, and only with the capacities listed as valid for each:\n\n` +
      `SELECTED APP STACK:\n${appStackBlock}\n========================================`;
  }
  return system;
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

  if (!process.env.ANTHROPIC_API_KEY) {
    setAgentStatus(slug, 'error', 'ANTHROPIC_API_KEY is not set');
    addEvent(slug, 'error', 'ANTHROPIC_API_KEY missing — add it to .env.local and retry.');
    generationInFlight.delete(slug);
    return;
  }

  setAgentStatus(slug, 'generating');
  addEvent(slug, 'info', startNote ?? `Forge online · model ${MODEL}. Designing agent…`);

  const businessSlug = getAgentBusinessSlug(slug);
  const appStackBlock = buildAppStackBlock(businessSlug);

  const system = buildSystemPrompt(appStackBlock);
  const userPrompt = applyPromptTemplate(getPromptContent('forge.user_template'), {
    slug,
    businessContext: agent.businessContext,
    jobDescription:
      agent.jobDescription ||
      '(none provided — infer the role from the business context and the title hint below)',
  });

  const controller = registerRun('agent', slug);

  try {
    const generator = runToolLoop({
      scopeType: 'agent',
      scopeSlug: slug,
      instructions: system,
      prompt: userPrompt,
      tools: createForgeTools({ agentSlug: slug, businessSlug }),
      model: MODEL,
      signal: controller.signal,
      startNote,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _event of generator) {
      /* turns persisted by runtime; legacy events emitted by tools */
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
