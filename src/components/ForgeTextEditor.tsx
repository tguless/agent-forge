'use client';

import { useState, useCallback, useEffect } from 'react';
import { sectionApiUrl } from '@/lib/editableSections';

type TextSectionVersion = {
  version: number;
  at: string;
  content: string;
  source: string;
  userInstructions?: string;
  changeSummary?: string;
  llmModel?: string;
};

type Props = {
  slug: string;
  sectionPath: string[];
  sectionLabel: string;
  initialContent: string;
  canRewrite?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

/** Modal editor for any blueprint text section — manual save, AI rewrite, version history. */
export function ForgeTextEditor({
  slug,
  sectionPath,
  sectionLabel,
  initialContent,
  canRewrite = true,
  onClose,
  onSaved,
}: Props) {
  const [content, setContent] = useState(initialContent);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<TextSectionVersion[]>([]);
  const [showAi, setShowAi] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  const apiBase = sectionApiUrl(slug, sectionPath);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      if (!res.ok) return;
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch {
      /* ignore */
    }
  }, [apiBase]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const handleSave = async () => {
    if (content === initialContent) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Save failed');
        return;
      }

      onSaved();
      void fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleAiRewrite = async () => {
    if (!instructions.trim()) return;
    setRewriting(true);
    setError('');
    setChangeSummary('');

    try {
      const res = await fetch(`/api/businesses/${slug}/sections/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: sectionPath, instructions: instructions.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Rewrite failed');
        return;
      }

      setContent(data.content);
      setChangeSummary(data.changeSummary ?? '');
      setInstructions('');
      void fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setRewriting(false);
    }
  };

  const restoreVersion = (v: TextSectionVersion) => {
    setContent(v.content);
    setShowHistory(false);
  };

  const hasChanges = content !== initialContent;

  return (
    <div className="forge-modal-backdrop" onClick={onClose}>
      <div
        className="forge-modal forge-plan-section-editor"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="forge-text-editor-title"
      >
        <div className="forge-modal-header spread">
          <h2 id="forge-text-editor-title">Edit: {sectionLabel}</h2>
          <button type="button" className="forge-cta forge-cta--ghost forge-cta--sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="forge-modal-body">
          <textarea
            className="forge-plan-section-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            disabled={rewriting}
          />

          {changeSummary && (
            <div className="forge-change-summary">
              <span className="forge-hint">AI changes: {changeSummary}</span>
            </div>
          )}

          {error && <div className="forge-editor-error">{error}</div>}

          <div className="forge-editor-actions">
            <button
              type="button"
              className="forge-cta forge-cta--sm"
              onClick={() => void handleSave()}
              disabled={saving || !hasChanges}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {canRewrite && (
              <button
                type="button"
                className="forge-cta forge-cta--ghost forge-cta--sm"
                onClick={() => setShowAi((v) => !v)}
              >
                {showAi ? 'Hide AI Assistant' : 'AI Rewrite'}
              </button>
            )}
            <button
              type="button"
              className="forge-cta forge-cta--ghost forge-cta--sm"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? 'Hide History' : `History (${versions.length})`}
            </button>
          </div>

          {showAi && canRewrite && (
            <div className="forge-ai-rewrite-section">
              <label htmlFor="forge-ai-instructions">Instructions for AI</label>
              <textarea
                id="forge-ai-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder="e.g. Add recent market sizing with citations, tighten bullets, emphasize differentiation…"
                disabled={rewriting}
              />
              <p className="forge-hint forge-ai-rewrite-hint">
                The assistant can search the web (Tavily) for fresh data when you ask for updated facts or citations.
              </p>
              <button
                type="button"
                className="forge-cta forge-cta--sm"
                onClick={() => void handleAiRewrite()}
                disabled={rewriting || !instructions.trim()}
              >
                {rewriting ? 'Rewriting…' : 'Apply AI Rewrite'}
              </button>
            </div>
          )}

          {showHistory && versions.length > 0 && (
            <div className="forge-version-history">
              {versions.map((v) => (
                <div key={v.version} className="forge-version-entry">
                  <div className="spread">
                    <span className="forge-hint">
                      v{v.version} · {v.source.replace(/_/g, ' ')} · {new Date(v.at).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      className="forge-cta forge-cta--ghost forge-cta--sm"
                      onClick={() => restoreVersion(v)}
                    >
                      Restore
                    </button>
                  </div>
                  {v.userInstructions && (
                    <p className="forge-hint">Instructions: {v.userInstructions}</p>
                  )}
                  {v.changeSummary && <p className="forge-hint">Changes: {v.changeSummary}</p>}
                  <p className="forge-prose-preview forge-hint">
                    {v.content.slice(0, 200)}
                    {v.content.length > 200 ? '…' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use ForgeTextEditor with sectionPath `['plan', sectionKey]`. */
export const PlanSectionEditor = ForgeTextEditor;
