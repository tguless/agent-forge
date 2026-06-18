'use client';

import React from 'react';
import {
  animateTextDecipherInPlace,
  FORGE_DECODE_DURATION_OPTS,
  getForgeTextDuration,
} from '@/lib/forgeArwesAnimate';

type ForgeLogLineProps = {
  children: string;
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** Forge log row body — decipher glyph fill-in (non-header body text). */
export function ForgeLogLine({
  children,
  animate = true,
  className = 'forge-log-body',
  style,
}: ForgeLogLineProps) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!animate) return;
    const el = ref.current;
    if (!el || !el.textContent?.length) return;

    const duration = getForgeTextDuration(el.textContent.length, FORGE_DECODE_DURATION_OPTS);
    const anim = animateTextDecipherInPlace({
      contentElement: el,
      duration,
      easing: 'linear',
      readoutSound: true,
    });
    return () => anim.cancel();
  }, [children, animate]);

  return (
    <span ref={ref} className={className} style={style}>
      {children}
    </span>
  );
}

export default ForgeLogLine;
