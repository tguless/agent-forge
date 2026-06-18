'use client';

import React from 'react';
import { createForgeIlluminator, resolveForgeIlluminatorColor } from '@/lib/forgeArwesIlluminator';

type ForgeInteractiveOptions = {
  /** Radial spotlight color; defaults to --card-accent on the element. */
  color?: string;
  size?: number;
  illuminator?: boolean;
};

/**
 * ARWES Illuminator spotlight + press state on interactive surfaces.
 * Click bleep is handled globally by ForgeSoundProvider (buttons/CTAs only).
 * @see .vendor/arwes/apps/docs/src/ui/Button/Button.tsx
 */
export function useForgeInteractive<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  options: ForgeInteractiveOptions = {},
): void {
  const { color, size = 300, illuminator = true } = options;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.classList.add('forge-interactive');

    const spotlight =
      illuminator &&
      createForgeIlluminator({
        container: el,
        color: color ?? resolveForgeIlluminatorColor(el),
        size,
      });

    const onPointerDown = () => {
      el.classList.add('forge-interactive--pressed');
    };

    const releasePress = () => {
      el.classList.remove('forge-interactive--pressed');
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', releasePress);
    el.addEventListener('pointerleave', releasePress);
    el.addEventListener('pointercancel', releasePress);

    return () => {
      if (spotlight) spotlight.cancel();
      el.classList.remove('forge-interactive', 'forge-interactive--pressed');
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', releasePress);
      el.removeEventListener('pointerleave', releasePress);
      el.removeEventListener('pointercancel', releasePress);
    };
  }, [ref, color, size, illuminator]);
}
