'use client';

import React from 'react';
import type { Business } from '@/lib/businessTypes';

export function BusinessPlaque({
  business,
  disabled = false,
}: {
  business: Business;
  disabled?: boolean;
}) {
  const [plaqueSrc, setPlaqueSrc] = React.useState(business.profile.plaquePath);
  const [regenerating, setRegenerating] = React.useState(false);
  const [plaqueError, setPlaqueError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPlaqueSrc(business.profile.plaquePath);
  }, [business.profile.plaquePath]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setPlaqueError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(business.slug)}/regenerate-plaque`, {
        method: 'POST',
      });
      const json = (await res.json()) as {
        error?: string;
        plaque?: { webPath?: string; generated?: boolean; notes?: string[] };
      };
      if (!res.ok) throw new Error(json.error ?? `Server error ${res.status}`);
      const plaque = json.plaque;
      if (plaque?.webPath) {
        setPlaqueSrc(`${plaque.webPath}?t=${Date.now()}`);
      }
      if (plaque && !plaque.generated) {
        setPlaqueError(plaque.notes?.join(' ') || 'Gemini unavailable — placeholder plaque was used.');
      }
    } catch (err) {
      setPlaqueError(err instanceof Error ? err.message : 'Failed to regenerate plaque');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="forge-business-plaque ops-detail-emblem" title={business.name}>
      {plaqueSrc ? (
        <img
          src={plaqueSrc}
          alt=""
          className="ops-detail-emblem-img forge-business-plaque-img"
          width={140}
          height={140}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling;
            if (fallback instanceof HTMLElement) fallback.style.display = 'flex';
          }}
        />
      ) : null}
      <span
        className="ops-detail-emblem-fallback"
        aria-hidden
        style={{ display: plaqueSrc ? 'none' : 'flex' }}
      >
        ◆
      </span>
      <button
        type="button"
        className="ops-detail-emblem-regen"
        disabled={disabled || regenerating}
        aria-busy={regenerating}
        title="Re-run Gemini plaque generation for this business"
        onClick={() => void handleRegenerate()}
      >
        {regenerating ? 'Regenerating…' : '↻ Regenerate plaque'}
      </button>
      {plaqueError && (
        <p className="ops-detail-emblem-error" role="alert">
          {plaqueError}
        </p>
      )}
    </div>
  );
}
