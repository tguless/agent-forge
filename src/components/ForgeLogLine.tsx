'use client';

import React from 'react';
import {
  animateTextDecipherInPlace,
  FORGE_DECODE_DURATION_OPTS,
  getForgeTextDuration,
} from '@/lib/forgeArwesAnimate';
import { useForgeUiSettings } from '@/components/ForgeUiSettingsProvider';

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
  const { textFillSoundsEnabled, typeReadoutStopRatio } = useForgeUiSettings();

  React.useEffect(() => {
    if (!animate) return;
    const el = ref.current;
    if (!el || !el.textContent?.length) return;

    const duration = getForgeTextDuration(el.textContent.length, FORGE_DECODE_DURATION_OPTS);
    const anim = animateTextDecipherInPlace({
      contentElement: el,
      duration,
      easing: 'linear',
      readoutSound: textFillSoundsEnabled,
      readoutStopRatio: typeReadoutStopRatio,
    });
    return () => anim.cancel();
  }, [children, animate, textFillSoundsEnabled, typeReadoutStopRatio]);

  return (
    <span ref={ref} className={className} style={style}>
      {children}
    </span>
  );
}

export default ForgeLogLine;
