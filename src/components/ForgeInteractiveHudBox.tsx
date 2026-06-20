'use client';

import React from 'react';
import { HudBox } from '@/components/HudBox';
import { useForgeInteractive } from '@/hooks/useForgeInteractive';

export type ForgeInteractiveHudBoxProps = React.ComponentProps<typeof HudBox> & {
  /** Accent for border shimmer and corner brackets (CSS color or var()). */
  accent?: string;
};

/** HudBox with homepage-style hover shimmer, accent edges, and ARWES illuminator. */
export function ForgeInteractiveHudBox({
  accent = 'var(--ops-cyan, #38bdf8)',
  className,
  children,
  style,
  ...rest
}: ForgeInteractiveHudBoxProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useForgeInteractive(ref, {
    color: 'color-mix(in srgb, var(--card-accent) 14%, transparent)',
    size: 280,
  });

  return (
    <HudBox
      ref={ref}
      className={['forge-shimmer-card', className].filter(Boolean).join(' ')}
      style={{ ...style, ['--card-accent' as string]: accent }}
      {...rest}
    >
      {children}
    </HudBox>
  );
}

export default ForgeInteractiveHudBox;
