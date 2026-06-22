/**
 * On-demand business plan generation for existing blueprints.
 * Uses scope `business-plan` and the shared business run lock so it cannot
 * overlap full consulting on the same slug.
 */
import { runToolLoop } from '@/lib/agent/runtime';
import { registerRun } from '@/lib/agent/runRegistry';
import { clearTurns, persistTurn, nextTurnIndex } from '@/lib/agent/turns';
import { textLlmConfigError, textLlmConfigured } from '@/lib/agent/textModel';
import { getBusiness } from '@/lib/businessStore';
import {
  BUSINESS_PLAN_SECTIONS,
  businessPlanIsComplete,
} from '@/lib/businessPlanSections';
import { getPromptContent } from '@/lib/forgeConfigStore';
import { applyPromptTemplate } from '@/lib/forgePrompts';
import {
  isPlanGenerationInFlight,
  releaseBusinessRun,
  tryAcquireBusinessRun,
} from './businessRunLock';
import { createBusinessPlanTools } from './businessTools';

export { isPlanGenerationInFlight } from './businessRunLock';

function buildProfileContext(slug: string): string {
  const business = getBusiness(slug);
  if (!business) return '(none)';
  const p = business.profile;
  const lines: string[] = [];
  if (p.industry) lines.push(`Industry: ${p.industry}`);
  if (p.businessModel) lines.push(`Model: ${p.businessModel}`);
  if (p.summary) lines.push(`Summary: ${p.summary}`);
  if (p.valueChain?.length) lines.push(`Value chain: ${p.valueChain.join(' → ')}`);
  if (p.elevatorPitch) lines.push(`Elevator pitch: ${p.elevatorPitch}`);
  return lines.length ? lines.join('\n') : '(none yet)';
}

function buildInstructions(): string {
  const sectionList = BUSINESS_PLAN_SECTIONS.map((s) => `- ${s.toolName}: ${s.label}`).join('\n');
  return `${getPromptContent('business.plan.system')}\n\nPlan tools:\n${sectionList}`;
}

/** Start plan generation. Returns false if blocked by the business run lock. */
export function startBusinessPlanGeneration(slug: string, opts?: { force?: boolean }): boolean {
  if (!tryAcquireBusinessRun(slug, 'plan', opts)) return false;
  void runBusinessPlanGeneration(slug)
    .catch((err) => {
      console.error('runBusinessPlanGeneration crashed', err);
    })
    .finally(() => {
      releaseBusinessRun(slug, 'plan');
    });
  return true;
}

async function runBusinessPlanGeneration(slug: string): Promise<void> {
  const business = getBusiness(slug);
  if (!business) return;

  if (businessPlanIsComplete(business.profile.businessPlan)) {
    persistTurn('business-plan', slug, nextTurnIndex('business-plan', slug), {
      role: 'SYSTEM',
      turnType: 'MESSAGE',
      content: 'Business plan is already complete — nothing to generate.',
    });
    return;
  }

  if (!textLlmConfigured()) {
    persistTurn('business-plan', slug, nextTurnIndex('business-plan', slug), {
      role: 'SYSTEM',
      turnType: 'ERROR',
      content: textLlmConfigError(),
    });
    return;
  }

  clearTurns('business-plan', slug);

  const controller = registerRun('business-plan', slug);
  const instructions = buildInstructions();
  const prompt = applyPromptTemplate(getPromptContent('business.plan.user_template'), {
    businessSlug: slug,
    businessName: business.name,
    businessDescription: business.description,
    profileContext: buildProfileContext(slug),
  });

  try {
    const generator = runToolLoop({
      scopeType: 'business-plan',
      scopeSlug: slug,
      instructions,
      prompt,
      tools: createBusinessPlanTools({ businessSlug: slug }),
      signal: controller.signal,
      maxSteps: Number(process.env.FORGE_PLAN_MAX_STEPS || 60),
      startNote:
        'Business plan writer online — drafting all eight sections + competitor analysis (Tavily)…',
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _event of generator) {
      /* persisted by runtime */
    }

    const updated = getBusiness(slug);
    const ok = businessPlanIsComplete(updated?.profile.businessPlan);
    if (!ok) {
      persistTurn('business-plan', slug, nextTurnIndex('business-plan', slug), {
        role: 'SYSTEM',
        turnType: 'ERROR',
        content: 'Plan generation ended before all eight sections were saved. Retry to continue.',
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    persistTurn('business-plan', slug, nextTurnIndex('business-plan', slug), {
      role: 'SYSTEM',
      turnType: 'ERROR',
      content: message,
    });
  }
}
