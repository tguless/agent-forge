'use client';

import React from 'react';
import Link from 'next/link';
import { ForgeMarkdown } from '@/components/ForgeMarkdown';
import { FORGE_PROMPT_DEFS, USE_PROMPT_TABS, type ForgePromptCategory, type ForgePromptKey } from '@/lib/forgePrompts';

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

const CATEGORY_ORDER: ForgePromptCategory[] = ['forge', 'skills', 'image'];
const CATEGORY_LABELS: Record<ForgePromptCategory, string> = {
  forge: 'Agent Forge',
  skills: 'Meta skills',
  image: 'Image prompts',
};

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
    <div className="ops-dashboard forge-config-page">
      <div className="forge-toolbar">
        <p className="ops-pitch" style={{ margin: 0 }}>
          <Link href="/" className="forge-config-back">
            ← All agents
          </Link>
        </p>
        <div className="forge-config-toolbar-actions">
          <Link href="/new" className="forge-cta forge-cta--ghost">
            Forge agent
          </Link>
        </div>
      </div>

      <div className="ops-hud-shell forge-config-shell">
        <span className="ops-hf-corner ops-hf-corner-tl" aria-hidden />
        <span className="ops-hf-corner ops-hf-corner-tr" aria-hidden />
        <div className="ops-hud-inner">
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
        </div>

        <footer className="ops-hud-bottom-rail">
          <span className="ops-bf-corner ops-bf-corner-bl" aria-hidden />
          <span className="ops-bf-corner ops-bf-corner-br" aria-hidden />
          <p className="ops-tagline">Anthropic system · meta skills · Gemini image prompts</p>
        </footer>
      </div>
    </div>
  );
}
