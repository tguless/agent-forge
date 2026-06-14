/**
 * Business-consulting agent run loop (ToolLoopAgent + Claude).
 * Runs in the background and persists a multi-turn timeline; the UI tails turns
 * over SSE. Cancellation flows through the shared run registry.
 */
import { runToolLoop } from '@/lib/agent/runtime';
import { registerRun, isRunActive } from '@/lib/agent/runRegistry';
import { persistTurn, nextTurnIndex } from '@/lib/agent/turns';
import {
  getBusiness,
  setBusinessStatus,
  listRoles,
  ensurePlaceholderBusiness,
} from '@/lib/businessStore';
import { listAppTypes, listCapacities } from '@/lib/catalogStore';
import { getPromptContent } from '@/lib/forgeConfigStore';
import { applyPromptTemplate } from '@/lib/forgePrompts';
import { createBusinessTools } from './businessTools';

const inFlight = new Set<string>();

function buildInstructions(): string {
  const appTypes = listAppTypes()
    .map((t) => `- ${t.key} (${t.label}): ${t.capacities.join(', ')}`)
    .join('\n');
  const capacities = listCapacities()
    .map((c) => `- ${c.key}: ${c.label}`)
    .join('\n');
  const core = applyPromptTemplate(getPromptContent('business.system'), { appTypes, capacities });
  return `${core}\n\n===== business-consultant skill =====\n${getPromptContent('skills.business_consultant')}`;
}

/** Fire-and-forget: start (or restart) the consulting run for a business. */
export function startBusinessConsult(slug: string, opts?: { force?: boolean }): void {
  if (inFlight.has(slug) && !opts?.force) return;
  void runBusinessConsult(slug).catch((err) => {
    console.error('runBusinessConsult crashed', err);
  });
}

export function isConsultInFlight(slug: string): boolean {
  return inFlight.has(slug) || isRunActive('business', slug);
}

async function runBusinessConsult(slug: string): Promise<void> {
  if (inFlight.has(slug)) return;
  const business = getBusiness(slug);
  if (!business) return;

  inFlight.add(slug);
  setBusinessStatus(slug, 'consulting');

  if (!process.env.ANTHROPIC_API_KEY) {
    setBusinessStatus(slug, 'error', 'ANTHROPIC_API_KEY is not set');
    persistTurn('business', slug, nextTurnIndex('business', slug), {
      role: 'SYSTEM',
      turnType: 'ERROR',
      content: 'ANTHROPIC_API_KEY missing — add it to .env.local and retry.',
    });
    inFlight.delete(slug);
    return;
  }

  const controller = registerRun('business', slug);
  const instructions = buildInstructions();
  const prompt = applyPromptTemplate(getPromptContent('business.user_template'), {
    businessSlug: slug,
    businessName: business.name,
    businessDescription: business.description,
  });

  try {
    const generator = runToolLoop({
      scopeType: 'business',
      scopeSlug: slug,
      instructions,
      prompt,
      tools: createBusinessTools({ businessSlug: slug }),
      signal: controller.signal,
      startNote: 'Business consultant online — profiling, recommending a stack, and designing roles…',
    });

    // Drive the run; turns are persisted inside the runtime.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _event of generator) {
      /* persisted by runtime; SSE tails the table */
    }

    const ok = listRoles(slug).length > 0;
    setBusinessStatus(slug, ok ? 'ready' : 'error', ok ? null : 'Consulting ended without any roles.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setBusinessStatus(slug, 'error', message);
  } finally {
    inFlight.delete(slug);
  }
}

/**
 * Bootstrap: ensure a placeholder business exists (adopting orphan agents) and,
 * if freshly created, run it through the consulting process.
 */
export function ensurePlaceholderBusinessAndConsult(): string {
  const { slug, created } = ensurePlaceholderBusiness();
  if (created) startBusinessConsult(slug);
  return slug;
}
