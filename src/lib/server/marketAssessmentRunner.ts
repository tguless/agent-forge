/**
 * On-demand market-analysis + advisory viability-verdict generation for an
 * existing blueprint. Reuses the `business-plan` turn scope and the shared
 * `plan` run-lock kind so it streams through the existing plan SSE channel and
 * cannot overlap a full consult or plan run on the same slug.
 */
import { runToolLoop } from '@/lib/agent/runtime';
import { registerRun } from '@/lib/agent/runRegistry';
import { clearTurns, persistTurn, nextTurnIndex } from '@/lib/agent/turns';
import { textLlmConfigError, textLlmConfigured } from '@/lib/agent/textModel';
import { getBusiness } from '@/lib/businessStore';
import { marketAssessmentIsComplete } from '@/lib/marketAssessment';
import { businessPlanIsComplete } from '@/lib/businessPlanSections';
import { competitorAnalysisHasContent } from '@/lib/competitorSections';
import { getPromptContent } from '@/lib/forgeConfigStore';
import { applyPromptTemplate } from '@/lib/forgePrompts';
import { releaseBusinessRun, tryAcquireBusinessRun } from './businessRunLock';
import { createMarketAssessmentRunTools } from './businessTools';

const SCOPE = 'business-plan' as const;

function buildProfileContext(slug: string): string {
  const business = getBusiness(slug);
  if (!business) return '(none)';
  const p = business.profile;
  const lines: string[] = [];
  if (p.industry) lines.push(`Industry: ${p.industry}`);
  if (p.businessModel) lines.push(`Model: ${p.businessModel}`);
  if (p.summary) lines.push(`Summary: ${p.summary}`);
  if (p.elevatorPitch) lines.push(`Elevator pitch: ${p.elevatorPitch}`);
  if (businessPlanIsComplete(p.businessPlan) && p.businessPlan?.targetMarket) {
    lines.push(`Target market (from plan): ${p.businessPlan.targetMarket}`);
  }
  if (competitorAnalysisHasContent(p.competitorAnalysis) && p.competitorAnalysis?.landscape) {
    lines.push(`Competitive landscape (from plan): ${p.competitorAnalysis.landscape}`);
  }
  return lines.length ? lines.join('\n') : '(none yet)';
}

/** Start the market assessment run. Returns false if blocked by the business run lock. */
export function startMarketAssessment(slug: string, opts?: { force?: boolean }): boolean {
  if (!tryAcquireBusinessRun(slug, 'plan', opts)) return false;
  void runMarketAssessment(slug)
    .catch((err) => {
      console.error('runMarketAssessment crashed', err);
    })
    .finally(() => {
      releaseBusinessRun(slug, 'plan');
    });
  return true;
}

async function runMarketAssessment(slug: string): Promise<void> {
  const business = getBusiness(slug);
  if (!business) return;

  if (!textLlmConfigured()) {
    persistTurn(SCOPE, slug, nextTurnIndex(SCOPE, slug), {
      role: 'SYSTEM',
      turnType: 'ERROR',
      content: textLlmConfigError(),
    });
    return;
  }

  clearTurns(SCOPE, slug);

  const controller = registerRun(SCOPE, slug);
  const instructions = getPromptContent('business.market.system');
  const prompt = applyPromptTemplate(getPromptContent('business.market.user_template'), {
    businessSlug: slug,
    businessName: business.name,
    businessDescription: business.description,
    profileContext: buildProfileContext(slug),
  });

  try {
    const generator = runToolLoop({
      scopeType: SCOPE,
      scopeSlug: slug,
      instructions,
      prompt,
      tools: createMarketAssessmentRunTools({ businessSlug: slug }),
      signal: controller.signal,
      maxSteps: Number(process.env.FORGE_MARKET_MAX_STEPS || 40),
      startNote:
        'Market analyst online — sizing the market (Tavily), grading demand, and drafting an advisory go/no-go verdict…',
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _event of generator) {
      /* persisted by runtime */
    }

    const updated = getBusiness(slug);
    if (!marketAssessmentIsComplete(updated?.profile.marketAssessment)) {
      persistTurn(SCOPE, slug, nextTurnIndex(SCOPE, slug), {
        role: 'SYSTEM',
        turnType: 'ERROR',
        content:
          'Market assessment ended before all parts (size, demand, timing, risks, verdict) were saved. Retry to continue.',
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    persistTurn(SCOPE, slug, nextTurnIndex(SCOPE, slug), {
      role: 'SYSTEM',
      turnType: 'ERROR',
      content: message,
    });
  }
}
