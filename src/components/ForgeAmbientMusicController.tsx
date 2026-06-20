'use client';

import React from 'react';
import { useForgeUiSettings } from '@/components/ForgeUiSettingsProvider';
import {
  setForgeAmbientMusicEnabled,
  startForgeAmbientMusic,
  stopForgeAmbientMusic,
} from '@/lib/forgeAmbientMusic';
import { unlockForgeAudio } from '@/lib/forgeBleeps';

/** Syncs Interface config → looping Forge Protocol ambient track (on by default). */
export function ForgeAmbientMusicController() {
  const { ui, loading } = useForgeUiSettings();

  React.useEffect(() => {
    setForgeAmbientMusicEnabled(ui.ambientMusicEnabled);
    if (!ui.ambientMusicEnabled) {
      stopForgeAmbientMusic();
    }
  }, [ui.ambientMusicEnabled]);

  React.useEffect(() => {
    if (loading || !ui.ambientMusicEnabled) return;

    const onUnlock = () => {
      unlockForgeAudio();
      void startForgeAmbientMusic();
    };

    document.addEventListener('pointerdown', onUnlock, { capture: true });
    document.addEventListener('keydown', onUnlock, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onUnlock, { capture: true });
      document.removeEventListener('keydown', onUnlock, { capture: true });
    };
  }, [ui.ambientMusicEnabled, loading]);

  return null;
}

export default ForgeAmbientMusicController;
