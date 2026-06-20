/**
 * Business plan section keys, labels, and consulting-tool metadata.
 * Each section is populated by its own tool so the UI can render a TOC +
 * collapsible panels.
 */
import type { BusinessPlanSectionKey, BusinessPlanSections } from './businessTypes';

export type BusinessPlanSectionDef = {
  key: BusinessPlanSectionKey;
  label: string;
  anchor: string;
  toolName: string;
  /** Tool description shown to the consulting agent. */
  toolDescription: string;
};

export const BUSINESS_PLAN_SECTIONS: BusinessPlanSectionDef[] = [
  {
    key: 'executiveSummary',
    label: 'Executive summary',
    anchor: 'plan-executive-summary',
    toolName: 'set_plan_executive_summary',
    toolDescription:
      'Write the executive summary (2–4 sentences). What the business is, who it serves, and the near-term outcome.',
  },
  {
    key: 'problemAndSolution',
    label: 'Problem & solution',
    anchor: 'plan-problem-solution',
    toolName: 'set_plan_problem_solution',
    toolDescription:
      'Describe the customer problem and your solution. Use bullets; name workflows or pain points from the description.',
  },
  {
    key: 'targetMarket',
    label: 'Target market & ICP',
    anchor: 'plan-target-market',
    toolName: 'set_plan_target_market',
    toolDescription:
      'Define target segments and ideal customer profile (ICP). Include firmographics, geography, and buying triggers.',
  },
  {
    key: 'revenueModel',
    label: 'Revenue model',
    anchor: 'plan-revenue-model',
    toolName: 'set_plan_revenue_model',
    toolDescription:
      'Explain how the business makes money: pricing model, unit economics, and primary revenue streams.',
  },
  {
    key: 'goToMarket',
    label: 'Go-to-market',
    anchor: 'plan-go-to-market',
    toolName: 'set_plan_go_to_market',
    toolDescription:
      'Outline acquisition channels, sales motion, partnerships, and the first 90-day GTM priorities.',
  },
  {
    key: 'operations',
    label: 'Operations',
    anchor: 'plan-operations',
    toolName: 'set_plan_operations',
    toolDescription:
      'Day-to-day operating model: key processes, team/functions, tooling, and service-level expectations.',
  },
  {
    key: 'yearOneMilestones',
    label: 'Year-one milestones',
    anchor: 'plan-year-one',
    toolName: 'set_plan_year_one_milestones',
    toolDescription:
      'Quarterly or phased milestones for year one — revenue, customers, product, headcount, or operational targets.',
  },
  {
    key: 'risksAndMitigations',
    label: 'Risks & mitigations',
    anchor: 'plan-risks',
    toolName: 'set_plan_risks_mitigations',
    toolDescription:
      'Top 3–5 risks and concrete mitigations. Be specific to this business, not generic boilerplate.',
  },
];

/** Coerce legacy single-string plans saved before per-section tools. */
export function normalizeBusinessPlan(raw: unknown): BusinessPlanSections | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed ? { executiveSummary: trimmed } : undefined;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as BusinessPlanSections;
  }
  return undefined;
}

export function businessPlanHasContent(plan: BusinessPlanSections | undefined): boolean {
  if (!plan) return false;
  return BUSINESS_PLAN_SECTIONS.some((s) => !!plan[s.key]?.trim());
}

export function businessPlanIsComplete(plan: BusinessPlanSections | undefined): boolean {
  if (!plan) return false;
  return BUSINESS_PLAN_SECTIONS.every((s) => !!plan[s.key]?.trim());
}

export function filledBusinessPlanSections(
  plan: BusinessPlanSections | undefined,
): Array<BusinessPlanSectionDef & { content: string }> {
  if (!plan) return [];
  return BUSINESS_PLAN_SECTIONS.filter((s) => plan[s.key]?.trim()).map((s) => ({
    ...s,
    content: plan[s.key]!.trim(),
  }));
}

/** Compact labels for plan sub-tabs (main bar uses full section labels). */
export const PLAN_SUBTAB_SHORT_LABELS: Record<BusinessPlanSectionKey, string> = {
  executiveSummary: 'Summary',
  problemAndSolution: 'Problem',
  targetMarket: 'ICP',
  revenueModel: 'Revenue',
  goToMarket: 'GTM',
  operations: 'Ops',
  yearOneMilestones: 'Year 1',
  risksAndMitigations: 'Risks',
};

export type PlanSubTabId = BusinessPlanSectionKey | 'competitors';

export function planSubTabFromHash(hash: string): PlanSubTabId | null {
  const id = hash.replace(/^#/, '');
  if (id === 'plan-competitors') return 'competitors';
  const byAnchor = BUSINESS_PLAN_SECTIONS.find((s) => s.anchor === id);
  if (byAnchor) return byAnchor.key;
  if (id.startsWith('plan-')) {
    const suffix = id.slice('plan-'.length);
    const byKey = BUSINESS_PLAN_SECTIONS.find((s) => s.key === suffix);
    if (byKey) return byKey.key;
  }
  return null;
}

export function planSubTabHash(subTab: PlanSubTabId): string {
  if (subTab === 'competitors') return 'plan-competitors';
  const def = BUSINESS_PLAN_SECTIONS.find((s) => s.key === subTab);
  return def?.anchor ?? 'plan-executive-summary';
}

export function defaultPlanSubTab(
  plan: BusinessPlanSections | undefined,
  includeCompetitors: boolean,
): PlanSubTabId {
  const filled = filledBusinessPlanSections(plan);
  if (filled.length > 0) return filled[0].key;
  return includeCompetitors ? 'competitors' : 'executiveSummary';
}
