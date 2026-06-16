/**
 * Market-assessment metadata + helpers: the advisory "is this worth pursuing?"
 * layer. Verdict vocabulary, narrative section defs, severity ordering, and
 * content/completeness checks for the UI and runners.
 *
 * The verdict is ALWAYS advisory — it surfaces pros, cons, and risks so the
 * operator can decide. It never decides for them.
 */
import type {
  ConfidenceLevel,
  MarketAssessment,
  RiskSeverity,
  ViabilityVerdict,
} from './businessTypes';

export type ViabilityVerdictDef = {
  key: ViabilityVerdict;
  label: string;
  /** Short gloss shown under the badge. */
  blurb: string;
  /** Visual tone for the badge (drives CSS class + color). */
  tone: 'green' | 'lime' | 'amber' | 'orange' | 'red';
};

/** Ordered most → least favorable. */
export const VIABILITY_VERDICTS: ViabilityVerdictDef[] = [
  {
    key: 'pursue',
    label: 'Worth pursuing',
    blurb: 'Real, reachable market and credible demand. Risks look manageable.',
    tone: 'green',
  },
  {
    key: 'pursue-conditional',
    label: 'Worth pursuing — with conditions',
    blurb: 'Promising, but contingent on validating a few key assumptions first.',
    tone: 'lime',
  },
  {
    key: 'mixed',
    label: 'Mixed — proceed carefully',
    blurb: 'Genuine upside offset by real headwinds. Sequence experiments before committing.',
    tone: 'amber',
  },
  {
    key: 'high-risk',
    label: 'High risk — validate before investing',
    blurb: 'Thin or unproven demand, or steep structural risk. De-risk cheaply first.',
    tone: 'orange',
  },
  {
    key: 'reconsider',
    label: 'Reconsider the premise',
    blurb: 'The evidence points against this as framed. Consider a pivot or a different wedge.',
    tone: 'red',
  },
];

export const VIABILITY_VERDICT_KEYS: ViabilityVerdict[] = VIABILITY_VERDICTS.map((v) => v.key);

export function viabilityVerdictDef(key: ViabilityVerdict | undefined): ViabilityVerdictDef | undefined {
  return VIABILITY_VERDICTS.find((v) => v.key === key);
}

export const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['low', 'medium', 'high'];
export const RISK_SEVERITIES: RiskSeverity[] = ['low', 'medium', 'high'];

export type MarketSectionKey = 'marketSize' | 'demandSignals' | 'timing';

export type MarketSectionDef = {
  key: MarketSectionKey;
  label: string;
  anchor: string;
};

/** Narrative (Markdown) sections, in display order. */
export const MARKET_SECTIONS: MarketSectionDef[] = [
  { key: 'marketSize', label: 'Market size (TAM / SAM / SOM)', anchor: 'market-size' },
  { key: 'demandSignals', label: 'Demand signals', anchor: 'market-demand' },
  { key: 'timing', label: 'Timing & trends', anchor: 'market-timing' },
];

const SEVERITY_RANK: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };

/** Sort risks by descending severity for display. */
export function sortRisksBySeverity<T extends { severity: RiskSeverity }>(risks: T[]): T[] {
  return [...risks].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export function marketAssessmentHasContent(assessment: MarketAssessment | undefined): boolean {
  if (!assessment) return false;
  return Boolean(
    assessment.verdict ||
      assessment.headline?.trim() ||
      assessment.marketSize?.trim() ||
      assessment.demandSignals?.trim() ||
      assessment.timing?.trim() ||
      assessment.recommendation?.trim() ||
      (assessment.pros?.length ?? 0) > 0 ||
      (assessment.cons?.length ?? 0) > 0 ||
      (assessment.risks?.length ?? 0) > 0,
  );
}

/**
 * "Complete enough" to call the assessment finished: a verdict plus the core
 * narrative and at least some pros/cons/risk evidence.
 */
export function marketAssessmentIsComplete(assessment: MarketAssessment | undefined): boolean {
  if (!assessment) return false;
  return Boolean(
    assessment.verdict &&
      assessment.headline?.trim() &&
      assessment.marketSize?.trim() &&
      assessment.demandSignals?.trim() &&
      (assessment.pros?.length ?? 0) > 0 &&
      (assessment.cons?.length ?? 0) > 0 &&
      (assessment.risks?.length ?? 0) > 0 &&
      assessment.recommendation?.trim(),
  );
}
