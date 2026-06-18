'use client';

import React from 'react';
import Link from 'next/link';
import { useForgeInteractive } from '@/hooks/useForgeInteractive';

export type ForgeBackGlyph = 'agents' | 'businesses' | 'business';

const SIGILS: Record<ForgeBackGlyph, string> = {
  agents: '▤',
  businesses: '▣',
  business: '◆',
};

type ForgeBackButtonProps = {
  href: string;
  label: string;
  glyph: ForgeBackGlyph;
  className?: string;
  style?: React.CSSProperties;
  /** Hide chevron (used inside a multi-link trail). */
  hideChevron?: boolean;
};

export function ForgeBackButton({
  href,
  label,
  glyph,
  className,
  style,
  hideChevron = false,
}: ForgeBackButtonProps) {
  const ref = React.useRef<HTMLAnchorElement>(null);

  useForgeInteractive(ref, {
    color: 'color-mix(in srgb, var(--ops-cyan-bright, #7fe7ff) 18%, transparent)',
    size: 200,
  });

  return (
    <Link
      ref={ref}
      href={href}
      className={['forge-back-btn', 'forge-interactive', className].filter(Boolean).join(' ')}
      style={style}
    >
      {!hideChevron && (
        <span className="forge-back-btn__chevron" aria-hidden>
          ◂
        </span>
      )}
      <span className="forge-back-btn__sigil" aria-hidden>
        {SIGILS[glyph]}
      </span>
      <span className="forge-back-btn__label">{label}</span>
    </Link>
  );
}

export type ForgeBackTrailItem = {
  href: string;
  label: string;
  glyph: ForgeBackGlyph;
};

/** Compact breadcrumb-style back rail — one row on phone, ARWES segmented treatment. */
export function ForgeBackTrail({ items }: { items: ForgeBackTrailItem[] }) {
  if (items.length === 0) return null;
  if (items.length === 1) {
    const only = items[0]!;
    return <ForgeBackButton href={only.href} label={only.label} glyph={only.glyph} />;
  }

  return (
    <nav className="forge-back-trail" aria-label="Back">
      {items.map((item, index) => (
        <React.Fragment key={item.href}>
          {index > 0 && (
            <span className="forge-back-trail__sep" aria-hidden>
              ›
            </span>
          )}
          <ForgeBackButton
            href={item.href}
            label={item.label}
            glyph={item.glyph}
            className="forge-back-btn--trail"
            hideChevron={index > 0}
          />
        </React.Fragment>
      ))}
    </nav>
  );
}

export function ForgeBackAgents(
  props: Omit<ForgeBackButtonProps, 'href' | 'label' | 'glyph'> = {},
) {
  return <ForgeBackButton href="/" label="All agents" glyph="agents" {...props} />;
}

export function ForgeBackBusinesses(
  props: Omit<ForgeBackButtonProps, 'href' | 'label' | 'glyph'> = {},
) {
  return <ForgeBackButton href="/business" label="All businesses" glyph="businesses" {...props} />;
}

export default ForgeBackButton;
