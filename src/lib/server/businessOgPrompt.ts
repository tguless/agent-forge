import type { Business } from '@/lib/businessTypes';

export type BusinessOgPromptInput = {
  badge?: string;
  title: string;
  subtitle: string;
  tagline: string;
  accent: string;
  /** Short HUD glyph phrase — same subject used for the business plaque center icon. */
  emblemSubject: string;
};

/** Landscape OG banner — sibling to /og-business-new.png, customized per business. */
export function buildBusinessOgPrompt(input: BusinessOgPromptInput): string {
  const badge = input.badge ?? 'PaperIQ';
  return [
    'Open Graph social sharing banner, landscape 1200x630, for Agent Forge — Business Blueprint.',
    'Use the attached reference image as the strict style guide: same dark olive-black HUD grid background (#1a2018),',
    'same left-side typography layout, same cyan-teal accent, same hyper-realistic 3D winged gunmetal-teal commander insignia plaque aesthetic (C&C RTS briefing screen).',
    'This is a sibling banner to the reference — match its lighting, metal textures, wing geometry, and overall composition.',
    `Left third typography only: small gray badge "${badge}",`,
    `large bold white military stencil headline "${input.title}",`,
    input.subtitle ? `accent color ${input.accent} subtitle "${input.subtitle}",` : '',
    input.tagline ? `smaller white tagline "${input.tagline}".` : '',
    'Right two-thirds: same winged commander insignia style as reference, but center sculpture integrates',
    `this business-specific HUD emblem motif: ${input.emblemSubject}`,
    '— still rendered as polished metal sculpture on the anvil with hammer strike sparks, plus partially unrolled blueprint scroll',
    'and faint cyan HUD business-plan panels (market chart silhouette, stacked document tabs).',
    `Primary accent ${input.accent} on sculpture and wing highlights, gold trim, micro-scratches, dimensional depth.`,
    'No text on the emblem. No watermark. High contrast, readable at small thumbnail size.',
  ]
    .filter(Boolean)
    .join(' ');
}

function firstLine(text: string, maxLen: number): string {
  const line = text.split(/\n+/)[0]?.trim() ?? '';
  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen - 1).trim()}…`;
}

/** Copy fields for OG typography from an existing business record. */
export function buildBusinessOgPromptInput(
  business: Pick<Business, 'name' | 'description' | 'profile'>,
  emblemSubject: string,
  accent: string,
): BusinessOgPromptInput {
  const subtitle =
    business.profile.industry?.trim() ||
    firstLine(business.profile.summary?.trim() || business.description.trim(), 72) ||
    'Business blueprint';

  const tagline =
    business.profile.marketAssessment?.headline?.trim() ||
    firstLine(business.profile.elevatorPitch?.trim() || '', 64) ||
    'Forged on Agent Forge';

  return {
    title: business.name.trim(),
    subtitle,
    tagline,
    accent,
    emblemSubject: emblemSubject.trim(),
  };
}
