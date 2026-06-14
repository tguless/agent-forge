import type { Business } from '@/lib/businessTypes';

const ACCENTS = ['#38bdf8', '#8ee85a', '#d4af37', '#5eead4', '#f0abfc', '#fb923c'];

/** Stable C&C accent from slug for plaque rim + icon highlights. */
export function plaqueAccent(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h + slug.charCodeAt(i) * 17) % ACCENTS.length;
  return ACCENTS[h]!;
}

/** Short sector hint for the plaque wrapper — not the full business description. */
export function buildPlaqueBusinessContext(
  business: Pick<Business, 'name' | 'description' | 'profile'>,
): string {
  const industry = business.profile.industry?.trim();
  const summary = business.profile.summary?.trim();
  if (industry && summary) return `${industry}. ${summary}`.slice(0, 160);
  if (industry) return industry.slice(0, 120);
  if (summary) return summary.slice(0, 160);
  return business.description.trim().slice(0, 120);
}

/** Short HUD glyph phrase — never dump the full business description here. */
function inferPlaqueGlyph(business: Pick<Business, 'name' | 'description' | 'profile'>): string {
  const text = [
    business.name,
    business.description,
    business.profile.industry ?? '',
    business.profile.summary ?? '',
  ]
    .join(' ')
    .toLowerCase();

  if (/patent|prior art|uspto|intellectual property|\bip\b/.test(text)) {
    return 'magnifying glass over fanned patent pages with one visible claim paragraph — HUD line icon';
  }
  if (/lease|abstract|commercial real estate|reit|tenant/.test(text)) {
    return 'stacked lease document pages with corner dog-ear — HUD line icon';
  }
  if (/prior auth|healthcare|clinical|patient|medical/.test(text)) {
    return 'clipboard with medical cross and checkmark — HUD line icon';
  }
  if (/ocr|document extract|pdf|paperiq|schema/.test(text)) {
    return 'document page with bracketed JSON schema lines — HUD line icon';
  }
  if (/security|cyber|identity|access control/.test(text)) {
    return 'shield with keyhole — HUD line icon';
  }
  if (/sales|outbound|pipeline|crm/.test(text)) {
    return 'paper airplane on upward trajectory — HUD line icon';
  }
  if (/finance|account|invoice|billing|ledger/.test(text)) {
    return 'ledger page with coin stack — HUD line icon';
  }
  if (/logistics|warehouse|shipping|freight/.test(text)) {
    return 'cargo box on pallet with motion lines — HUD line icon';
  }

  const hint = business.profile.industry?.trim() || business.name.trim();
  return `one abstract HUD glyph for ${hint} — simple geometric symbol, not a generic book or building`;
}

/**
 * Center-icon subject for the plaque. Prefer LLM-authored plaqueSubject (short glyph phrase).
 * Regenerate fallback uses inferPlaqueGlyph — never the full business description.
 */
export function derivePlaqueSubject(business: Pick<Business, 'name' | 'description' | 'profile'>): string {
  if (business.profile.plaqueSubject?.trim()) return business.profile.plaqueSubject.trim();
  return inferPlaqueGlyph(business);
}
