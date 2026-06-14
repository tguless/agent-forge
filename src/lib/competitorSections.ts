/**
 * Competitor analysis subsection keys/labels + helpers.
 * Each competitor is built one subsection at a time so the UI can render
 * collapsible per-competitor cards with a consistent structure.
 */
import type {
  Competitor,
  CompetitorAnalysis,
  CompetitorSectionKey,
} from './businessTypes';

export type CompetitorSectionDef = {
  key: CompetitorSectionKey;
  label: string;
};

export const COMPETITOR_SECTIONS: CompetitorSectionDef[] = [
  { key: 'positioning', label: 'Positioning' },
  { key: 'offerings', label: 'Offerings & features' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'strengths', label: 'Strengths' },
  { key: 'weaknesses', label: 'Weaknesses & gaps' },
  { key: 'ourEdge', label: 'Our edge vs them' },
];

export const COMPETITOR_SECTION_KEYS: CompetitorSectionKey[] = COMPETITOR_SECTIONS.map(
  (s) => s.key,
);

export function competitorSectionLabel(key: CompetitorSectionKey): string {
  return COMPETITOR_SECTIONS.find((s) => s.key === key)?.label ?? key;
}

export function competitorAnalysisHasContent(
  analysis: CompetitorAnalysis | undefined,
): boolean {
  if (!analysis) return false;
  return !!analysis.landscape?.trim() || (analysis.competitors?.length ?? 0) > 0;
}

export function filledCompetitorSections(
  competitor: Competitor,
): Array<CompetitorSectionDef & { content: string }> {
  return COMPETITOR_SECTIONS.filter((s) => competitor.sections[s.key]?.trim()).map((s) => ({
    ...s,
    content: competitor.sections[s.key]!.trim(),
  }));
}
