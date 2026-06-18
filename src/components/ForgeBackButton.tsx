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
};

export function ForgeBackButton({ href, label, glyph, className, style }: ForgeBackButtonProps) {
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
      <span className="forge-back-btn__chevron" aria-hidden>
        ◂
      </span>
      <span className="forge-back-btn__sigil" aria-hidden>
        {SIGILS[glyph]}
      </span>
      <span className="forge-back-btn__label">{label}</span>
    </Link>
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
