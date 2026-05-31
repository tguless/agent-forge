/** Tactical HUD section icons (copied from PaperIQ ops into /public/forge/detail-icons). */
export const DETAIL_SECTION_ICONS = {
  mission: '/forge/detail-icons/mission.png',
  objectives: '/forge/detail-icons/objectives.png',
  inputs: '/forge/detail-icons/inputs.png',
  escalate: '/forge/detail-icons/escalate.png',
  responsibilities: '/forge/detail-icons/responsibilities.png',
  outputs: '/forge/detail-icons/outputs.png',
  q1Objective: '/forge/detail-icons/q1-objective.png',
  successCriteria: '/forge/detail-icons/success-criteria.png',
  keyMetrics: '/forge/detail-icons/key-metrics.png',
  decisionFramework: '/forge/detail-icons/decision-framework.png',
  deliverables: '/forge/detail-icons/deliverables.png',
} as const;

export function splitQuoteParagraphs(quote: string): string[] {
  const trimmed = quote.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/(?<=\.)\s+/).filter(Boolean);
  return parts.map((p) => {
    const t = p.trim();
    return t.endsWith('.') ? t : `${t}.`;
  });
}
