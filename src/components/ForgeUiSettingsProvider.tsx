'use client';

import React from 'react';
import { DEFAULT_FORGE_UI_SETTINGS, type ForgeUiSettings } from '@/lib/forgeUiSettings';

type ForgeUiSettingsContextValue = {
  ui: ForgeUiSettings;
  loading: boolean;
  saving: boolean;
  setUiSettings: (partial: Partial<ForgeUiSettings>) => Promise<void>;
  textFillTiming: ForgeUiSettings['textFillTiming'];
  textFillRandomMaxMs: number;
  typeReadoutStopRatio: number;
};

const ForgeUiSettingsContext = React.createContext<ForgeUiSettingsContextValue | null>(null);

export function ForgeUiSettingsProvider({ children }: { children: React.ReactNode }) {
  const [ui, setUi] = React.useState<ForgeUiSettings>(DEFAULT_FORGE_UI_SETTINGS);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/forge/config', { cache: 'no-store' });
        const json = (await res.json()) as { ui?: ForgeUiSettings; error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        if (!cancelled) {
          setUi({ ...DEFAULT_FORGE_UI_SETTINGS, ...json.ui });
        }
      } catch {
        if (!cancelled) setUi(DEFAULT_FORGE_UI_SETTINGS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setUiSettings = React.useCallback(async (partial: Partial<ForgeUiSettings>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/forge/config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(partial),
      });
      const json = (await res.json()) as { ui?: ForgeUiSettings; error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.ui) setUi(json.ui);
    } finally {
      setSaving(false);
    }
  }, []);

  const value = React.useMemo(
    () => ({
      ui,
      loading,
      saving,
      setUiSettings,
      textFillTiming: ui.textFillTiming,
      textFillRandomMaxMs: ui.textFillRandomMaxMs,
      typeReadoutStopRatio: ui.typeReadoutStopRatio,
    }),
    [ui, loading, saving, setUiSettings],
  );

  return <ForgeUiSettingsContext.Provider value={value}>{children}</ForgeUiSettingsContext.Provider>;
}

export function useForgeUiSettings(): ForgeUiSettingsContextValue {
  const ctx = React.useContext(ForgeUiSettingsContext);
  if (!ctx) {
    throw new Error('useForgeUiSettings must be used within ForgeUiSettingsProvider');
  }
  return ctx;
}

export default ForgeUiSettingsProvider;
