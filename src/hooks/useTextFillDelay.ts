'use client';

import React from 'react';
import { resolveTextFillDelay } from '@/lib/forgeUiSettings';
import { useForgeUiSettings } from '@/components/ForgeUiSettingsProvider';

/** Resolve per-block text fill delay from current Interface settings. */
export function useTextFillDelay() {
  const { textFillTiming, textFillRandomMaxMs } = useForgeUiSettings();

  return React.useCallback(
    (seed: string, staggerSeconds = 0) =>
      resolveTextFillDelay(textFillTiming, {
        staggerSeconds,
        randomMaxMs: textFillRandomMaxMs,
        randomSeed: seed,
      }),
    [textFillTiming, textFillRandomMaxMs],
  );
}
