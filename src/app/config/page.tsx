'use client';

import React from 'react';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import { ForgePageShell } from '@/components/ForgePageShell';
import { ForgeTopNav } from '@/components/ForgeTopNav';
import { FORGE_PROMPT_DEFS, USE_PROMPT_TABS, type ForgePromptCategory, type ForgePromptKey } from '@/lib/forgePrompts';
import { useForgeUiSettings } from '@/components/ForgeUiSettingsProvider';
import { FORGE_AMBIENT_TRACK } from '@/lib/forgeMusic';
import { startForgeAmbientMusic, stopForgeAmbientMusic } from '@/lib/forgeAmbientMusic';
import { unlockForgeAudio } from '@/lib/forgeBleeps';
import {
  READOUT_STOP_RATIO_MAX,
  READOUT_STOP_RATIO_MIN,
  GRID_MOVING_LINES_INTERVAL_SEC_MAX,
  GRID_MOVING_LINES_INTERVAL_SEC_MIN,
  GRID_MOVING_LINES_INTERVAL_SEC_STEP,
  TEXT_FILL_RANDOM_MAX_MS_MAX,
  TEXT_FILL_RANDOM_MAX_MS_MIN,
  type TextFillTiming,
} from '@/lib/forgeUiSettings';

type PromptRecord = {
  key: ForgePromptKey;
  label: string;
  category: ForgePromptCategory;
  categoryLabel: string;
  description: string;
  placeholders: string[];
  format: 'markdown' | 'text';
  content: string;
  defaultContent: string;
  isCustomized: boolean;
  updatedAt: number | null;
};

const CATEGORY_ORDER: ForgePromptCategory[] = ['forge', 'business', 'skills', 'image'];
const CATEGORY_LABELS: Record<ForgePromptCategory, string> = {
  forge: 'Agent Forge',
  business: 'Business Consultant',
  skills: 'Meta skills',
  image: 'Image prompts',
};

const TEXT_FILL_TIMING_OPTIONS: { value: TextFillTiming; label: string; hint: string }[] = [
  {
    value: 'none',
    label: 'None',
    hint: 'All box text fills start immediately.',
  },
  {
    value: 'stagger',
    label: 'Staggered',
    hint: 'Cards and detail sections reveal in fixed sequence.',
  },
  {
    value: 'random',
    label: 'Random start',
    hint: 'Each block picks a stable random delay within the window below.',
  },
];

export default function ForgeConfigPage() {
  const [prompts, setPrompts] = React.useState<PromptRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<ForgePromptCategory>('forge');
  const [selectedKey, setSelectedKey] = React.useState<ForgePromptKey>('forge.system');
  const [draft, setDraft] = React.useState('');
  const [view, setView] = React.useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const { ui, saving: uiSaving, setUiSettings } = useForgeUiSettings();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/forge/config', { cache: 'no-store' });
      const json = (await res.json()) as { prompts?: PromptRecord[]; error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setPrompts(json.prompts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const categoryPrompts = React.useMemo(
    () => prompts.filter((p) => p.category === category),
    [prompts, category],
  );

  const active = React.useMemo(
    () => prompts.find((p) => p.key === selectedKey) ?? null,
    [prompts, selectedKey],
  );

  React.useEffect(() => {
    if (categoryPrompts.length === 0) return;
    if (!categoryPrompts.some((p) => p.key === selectedKey)) {
      setSelectedKey(categoryPrompts[0]!.key);
    }
  }, [categoryPrompts, selectedKey]);

  React.useEffect(() => {
    if (active) {
      setDraft(active.content);
      setDirty(false);
      setView('edit');
    }
  }, [active?.key, active?.content]);

  const save = async () => {
    if (!active) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/forge/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: active.key, content: draft }),
      });
      const json = (await res.json()) as { prompt?: PromptRecord; error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.prompt) {
        setPrompts((prev) => prev.map((p) => (p.key === json.prompt!.key ? json.prompt! : p)));
        setDirty(false);
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const resetCurrent = async () => {
    if (!active) return;
    if (!window.confirm(`Reset "${active.label}" to the shipped default?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/forge/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reset', key: active.key }),
      });
      const json = (await res.json()) as { prompt?: PromptRecord; error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.prompt) {
        setPrompts((prev) => prev.map((p) => (p.key === json.prompt!.key ? json.prompt! : p)));
        setDraft(json.prompt.defaultContent);
        setDirty(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  const resetAll = async () => {
    if (!window.confirm('Reset ALL prompts to shipped defaults? Custom edits will be lost.')) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/forge/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reset_all' }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset all failed');
    } finally {
      setSaving(false);
    }
  };

  const customizedCount = prompts.filter((p) => p.isCustomized).length;

  return (
    <ForgePageShell
      frame="hud"
      pageClassName="forge-config-page"
      shellClassName="forge-config-shell"
      nav={<ForgeTopNav variant="dashboard" />}
      footer={
        <footer className="ops-hud-bottom-rail">
          <span className="ops-bf-corner ops-bf-corner-bl" aria-hidden />
          <span className="ops-bf-corner ops-bf-corner-br" aria-hidden />
          <p className="ops-tagline">Anthropic system · meta skills · Gemini image prompts</p>
        </footer>
      }
    >
          <header className="forge-config-header">
            <div className="forge-wordmark forge-wordmark--lg">
              AGENT<span>FORGE</span>
            </div>
            <h1 className="ops-title">
              Forge configuration
              <span className="ops-title-line2">Edit every LLM prompt the Forge sends</span>
            </h1>
            <p className="forge-config-lede">
              Changes are stored locally in SQLite and apply to the next agent you forge.
              {customizedCount > 0 && (
                <span className="forge-config-badge">{customizedCount} customized</span>
              )}
            </p>
          </header>

          {loading ? (
            <p className="forge-empty">Loading prompt registry…</p>
          ) : error && prompts.length === 0 ? (
            <p className="forge-error">{error}</p>
          ) : (
            <>
              <section className="forge-config-interface" aria-labelledby="forge-config-interface-title">
                <h2 id="forge-config-interface-title" className="forge-config-interface-title">
                  Interface
                </h2>
                <label className="forge-config-toggle-row">
                  <span className="forge-config-toggle-copy">
                    <span className="forge-config-toggle-label">Text fill sounds</span>
                    <span className="forge-config-toggle-hint">
                      Looping typing readout while ARWES text fills in.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="forge-config-toggle-input"
                    checked={ui.textFillSoundsEnabled}
                    disabled={uiSaving}
                    onChange={(e) => void setUiSettings({ textFillSoundsEnabled: e.target.checked })}
                  />
                </label>
                <label className="forge-config-toggle-row forge-config-toggle-row--spaced">
                  <span className="forge-config-toggle-copy">
                    <span className="forge-config-toggle-label">Button sounds</span>
                    <span className="forge-config-toggle-hint">
                      Click and error bleeps on buttons, CTAs, and interactive surfaces.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="forge-config-toggle-input"
                    checked={ui.buttonSoundsEnabled}
                    disabled={uiSaving}
                    onChange={(e) => void setUiSettings({ buttonSoundsEnabled: e.target.checked })}
                  />
                </label>
                <label className="forge-config-toggle-row forge-config-toggle-row--spaced">
                  <span className="forge-config-toggle-copy">
                    <span className="forge-config-toggle-label">Ambient music</span>
                    <span className="forge-config-toggle-hint">
                      Loop &ldquo;{FORGE_AMBIENT_TRACK.title}&rdquo; in the background after your next click.
                      Off by default.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="forge-config-toggle-input"
                    checked={ui.ambientMusicEnabled}
                    disabled={uiSaving}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      void setUiSettings({ ambientMusicEnabled: enabled }).then(() => {
                        if (enabled) {
                          unlockForgeAudio();
                          void startForgeAmbientMusic();
                        } else {
                          stopForgeAmbientMusic();
                        }
                      });
                    }}
                  />
                </label>
                <fieldset className="forge-config-timing-fieldset">
                  <legend className="forge-config-toggle-label">Box text fill timing</legend>
                  <p className="forge-config-toggle-hint">
                    Controls when agent card and detail panel text animations begin.
                  </p>
                  <div className="forge-config-timing-options">
                    {TEXT_FILL_TIMING_OPTIONS.map((option) => (
                      <label key={option.value} className="forge-config-timing-option">
                        <input
                          type="radio"
                          name="textFillTiming"
                          value={option.value}
                          checked={ui.textFillTiming === option.value}
                          disabled={uiSaving}
                          onChange={() => void setUiSettings({ textFillTiming: option.value })}
                        />
                        <span className="forge-config-timing-option-copy">
                          <span className="forge-config-timing-option-label">{option.label}</span>
                          <span className="forge-config-timing-option-hint">{option.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {ui.textFillTiming === 'random' && (
                  <label className="forge-config-range-row forge-config-range-row--nested">
                    <span className="forge-config-toggle-copy">
                      <span className="forge-config-toggle-label">Random start window</span>
                      <span className="forge-config-toggle-hint">
                        Each text block delays by a random amount from 0 up to this many milliseconds.
                      </span>
                    </span>
                    <div className="forge-config-range-control">
                      <input
                        type="number"
                        className="forge-config-number-input"
                        min={TEXT_FILL_RANDOM_MAX_MS_MIN}
                        max={TEXT_FILL_RANDOM_MAX_MS_MAX}
                        step={50}
                        value={ui.textFillRandomMaxMs}
                        disabled={uiSaving}
                        onChange={(e) =>
                          void setUiSettings({ textFillRandomMaxMs: Number(e.target.value) })
                        }
                      />
                      <span className="forge-config-range-value">ms</span>
                    </div>
                  </label>
                )}
                <label className="forge-config-range-row">
                  <span className="forge-config-toggle-copy">
                    <span className="forge-config-toggle-label">Type sound stop point</span>
                    <span className="forge-config-toggle-hint">
                      Stop the typing sound after this share of characters is revealed. Lower values
                      cut the sound earlier; 100% keeps it through the full text fill.
                    </span>
                  </span>
                  <div className="forge-config-range-control">
                    <input
                      type="range"
                      className="forge-config-range-input"
                      min={Math.round(READOUT_STOP_RATIO_MIN * 100)}
                      max={Math.round(READOUT_STOP_RATIO_MAX * 100)}
                      step={1}
                      value={Math.round(ui.typeReadoutStopRatio * 100)}
                      disabled={uiSaving}
                      onChange={(e) =>
                        void setUiSettings({ typeReadoutStopRatio: Number(e.target.value) / 100 })
                      }
                    />
                    <span className="forge-config-range-value">
                      {Math.round(ui.typeReadoutStopRatio * 100)}%
                    </span>
                  </div>
                </label>
                <label className="forge-config-range-row">
                  <span className="forge-config-toggle-copy">
                    <span className="forge-config-toggle-label">Grid scan line cycle</span>
                    <span className="forge-config-toggle-hint">
                      Seconds for one full vertical sweep on the ARWES background. Higher is
                      slower. Applies to every page with the animated grid.
                    </span>
                  </span>
                  <div className="forge-config-range-control">
                    <input
                      type="range"
                      className="forge-config-range-input"
                      min={GRID_MOVING_LINES_INTERVAL_SEC_MIN}
                      max={GRID_MOVING_LINES_INTERVAL_SEC_MAX}
                      step={GRID_MOVING_LINES_INTERVAL_SEC_STEP}
                      value={ui.gridMovingLinesIntervalSec}
                      disabled={uiSaving}
                      onChange={(e) =>
                        void setUiSettings({
                          gridMovingLinesIntervalSec: Number(e.target.value),
                        })
                      }
                    />
                    <span className="forge-config-range-value">
                      {ui.gridMovingLinesIntervalSec}s
                    </span>
                  </div>
                </label>
              </section>

              <div className="forge-config-category-tabs" role="tablist" aria-label="Prompt category">
                {CATEGORY_ORDER.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={category === cat}
                    className={`forge-config-cat-tab${category === cat ? ' forge-config-cat-tab--active' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              <div className="forge-config-selector-row">
                {USE_PROMPT_TABS ? (
                  <div className="forge-config-prompt-tabs" role="tablist" aria-label="Prompt">
                    {categoryPrompts.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        role="tab"
                        aria-selected={selectedKey === p.key}
                        className={`forge-config-prompt-tab${selectedKey === p.key ? ' forge-config-prompt-tab--active' : ''}${p.isCustomized ? ' forge-config-prompt-tab--custom' : ''}`}
                        onClick={() => setSelectedKey(p.key)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <label className="forge-config-select-wrap">
                    <span className="forge-label">Prompt</span>
                    <select
                      className="forge-config-select"
                      value={selectedKey}
                      onChange={(e) => setSelectedKey(e.target.value as ForgePromptKey)}
                    >
                      {FORGE_PROMPT_DEFS.filter((d) => d.category === category).map((d) => {
                        const rec = prompts.find((p) => p.key === d.key);
                        return (
                          <option key={d.key} value={d.key}>
                            {d.label}
                            {rec?.isCustomized ? ' · customized' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                )}
              </div>

              {active && (
                <div className="forge-config-editor-shell">
                  <div className="forge-config-meta">
                    <p className="forge-config-desc">{active.description}</p>
                    {active.placeholders.length > 0 && (
                      <p className="forge-config-placeholders">
                        Runtime placeholders:{' '}
                        {active.placeholders.map((ph) => (
                          <code key={ph} className="forge-config-ph">
                            {ph}
                          </code>
                        ))}
                      </p>
                    )}
                    {active.isCustomized && (
                      <p className="forge-config-custom-note">Custom override active (saved in forge.db).</p>
                    )}
                  </div>

                  <div className="forge-config-view-tabs" role="tablist" aria-label="Editor view">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'edit'}
                      className={`forge-config-view-tab${view === 'edit' ? ' forge-config-view-tab--active' : ''}`}
                      onClick={() => setView('edit')}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'preview'}
                      className={`forge-config-view-tab${view === 'preview' ? ' forge-config-view-tab--active' : ''}`}
                      onClick={() => setView('preview')}
                    >
                      Preview
                    </button>
                  </div>

                  {view === 'edit' ? (
                    <textarea
                      className="forge-textarea forge-config-textarea"
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setDirty(true);
                      }}
                      spellCheck={active.format === 'markdown'}
                      aria-label={`Edit ${active.label}`}
                    />
                  ) : (
                    <div className="forge-config-preview ops-detail-skills-overlay-body">
                      {active.format === 'markdown' ? (
                        <ForgeMarkdown>{draft || '_Empty prompt_'}</ForgeMarkdown>
                      ) : (
                        <pre className="forge-config-plain-preview">{draft || 'Empty prompt'}</pre>
                      )}
                    </div>
                  )}

                  <div className="forge-config-actions">
                    <button
                      type="button"
                      className="forge-cta"
                      disabled={saving || !dirty}
                      onClick={() => void save()}
                    >
                      {saving ? 'Saving…' : savedFlash ? 'Saved' : 'Save prompt'}
                    </button>
                    <button
                      type="button"
                      className="forge-cta forge-cta--ghost"
                      disabled={saving}
                      onClick={() => void resetCurrent()}
                    >
                      Reset to default
                    </button>
                    <button
                      type="button"
                      className="forge-config-reset-all"
                      disabled={saving}
                      onClick={() => void resetAll()}
                    >
                      Reset all
                    </button>
                    {dirty && <span className="forge-config-unsaved">Unsaved changes</span>}
                  </div>
                  {error && <p className="forge-error">{error}</p>}
                </div>
              )}
            </>
          )}
    </ForgePageShell>
  );
}
