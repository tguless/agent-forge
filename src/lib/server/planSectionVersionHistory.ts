/**
 * @deprecated Prefer textSectionVersionHistory with path ['plan', sectionKey].
 * Kept for backward compatibility with existing plan-versions files.
 */
import {
  appendTextSectionVersion,
  listTextSectionVersions,
  type TextSectionVersion,
  type TextSectionVersionSource,
} from '@/lib/server/textSectionVersionHistory';

export type PlanSectionVersionSource = TextSectionVersionSource;
export type PlanSectionVersion = TextSectionVersion;

export function appendPlanSectionVersion(
  slug: string,
  sectionKey: string,
  entry: Omit<PlanSectionVersion, 'version' | 'at'>,
): PlanSectionVersion {
  return appendTextSectionVersion(slug, ['plan', sectionKey], entry);
}

export function listPlanSectionVersions(slug: string, sectionKey: string): PlanSectionVersion[] {
  return listTextSectionVersions(slug, ['plan', sectionKey]);
}
