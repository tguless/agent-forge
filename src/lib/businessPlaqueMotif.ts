import type { Business } from '@/lib/businessTypes';

const ACCENTS = ['#38bdf8', '#8ee85a', '#d4af37', '#5eead4', '#f0abfc', '#fb923c'];

/** Stable C&C accent from slug for plaque rim + icon highlights. */
export function plaqueAccent(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h + slug.charCodeAt(i) * 17) % ACCENTS.length;
  return ACCENTS[h]!;
}

/** Operator context passed into the Gemini plaque prompt wrapper. */
export function buildPlaqueBusinessContext(
  business: Pick<Business, 'name' | 'description' | 'profile'>,
): string {
  const parts = [
    business.description.trim(),
    business.profile.industry ? `Industry: ${business.profile.industry}.` : '',
    business.profile.businessModel ? `Model: ${business.profile.businessModel}.` : '',
    business.profile.summary?.trim(),
  ].filter(Boolean);
  return parts.join(' ').slice(0, 420);
}

/**
 * Center-icon subject for the plaque. Prefer LLM-authored plaqueSubject from consult;
 * regenerate fallback builds from this business's name + description (not generic sector labels).
 */
export function derivePlaqueSubject(business: Pick<Business, 'name' | 'description' | 'profile'>): string {
  if (business.profile.plaqueSubject?.trim()) return business.profile.plaqueSubject.trim();

  const name = business.name.trim();
  const ctx = buildPlaqueBusinessContext(business);
  return (
    `minimalist neon line-art center icon that uniquely represents the business "${name}" — ` +
    `${ctx.slice(0, 220)}. One symbolic icon only on the metal plate; must reflect THIS business, not a generic sector badge.`
  );
}
