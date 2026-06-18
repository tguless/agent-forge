'use client';

import React from 'react';
import { playForgeClick, unlockForgeAudio } from '@/lib/forgeBleeps';

const CLICK_SOUND_SELECTOR =
  'button:not(:disabled), a.forge-cta, .forge-cta, .forge-back-btn, .forge-interactive';

/**
 * Global ARWES click bleep for buttons, CTAs, and interactive surfaces.
 */
export function ForgeSoundProvider({ children }: { children: React.ReactNode }) {
  React.useLayoutEffect(() => {
    const onPointerDown = () => {
      unlockForgeAudio();
    };

    const onTouchStart = () => {
      unlockForgeAudio();
    };

    const onClick = (event: MouseEvent) => {
      unlockForgeAudio();
      const target = event.target;
      if (!(target instanceof Element)) return;
      const el = target.closest(CLICK_SOUND_SELECTOR);
      if (!el || el.closest('[data-forge-silent]')) return;
      playForgeClick();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('keydown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('keydown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return <>{children}</>;
}

export default ForgeSoundProvider;
