'use client';

import React from 'react';
import { ForgeDecodeText, ForgeFlowText, ForgeHeaderText } from '@/components/ForgeArwesText';
import { FORGE_DECODE_HUD_OPTS, getForgeTextDuration } from '@/lib/forgeArwesAnimate';
import { useTextFillDelay } from '@/hooks/useTextFillDelay';

export type ForgeAnimatedPageHeaderProps = {
  /** Stable prefix for play-once animate ids on this page. */
  scope: string;
  wordmark: React.ReactNode;
  /** Plain-text length of the wordmark (for decode timing). */
  wordmarkChars: number;
  lead: string;
  title?: string;
  subtitle?: string;
  className?: string;
};

/** Centered HUD page header — decode wordmark + optional title lines + decode lead blurb. */
export function ForgeAnimatedPageHeader({
  scope,
  wordmark,
  wordmarkChars,
  lead,
  title,
  subtitle,
  className,
}: ForgeAnimatedPageHeaderProps) {
  const fillDelay = useTextFillDelay();

  return (
    <header className={['forge-page-header', className].filter(Boolean).join(' ')}>
      <ForgeDecodeText
        as="div"
        className="forge-wordmark forge-wordmark--lg"
        layout="inline"
        contentStyle={{ color: 'inherit', fontFamily: 'inherit' }}
        animateId={`${scope}:wordmark`}
        playOnce
        reserveLayout
        delay={fillDelay(`${scope}:wordmark`, 0)}
        duration={getForgeTextDuration(wordmarkChars, FORGE_DECODE_HUD_OPTS)}
      >
        {wordmark}
      </ForgeDecodeText>

      {(title || subtitle) && (
        <h1 className="ops-title">
          {title ? (
            <ForgeHeaderText
              className="ops-title-arwes"
              duration={1.1}
              easing="outExpo"
              animateId={`${scope}:title:${title}`}
              playOnce
              delay={fillDelay(`${scope}:title`, 0.12)}
            >
              {title}
            </ForgeHeaderText>
          ) : null}
          {subtitle ? (
            <span className="ops-title-line2">
              <ForgeFlowText
                animateId={`${scope}:subtitle:${subtitle}`}
                playOnce
                delay={fillDelay(`${scope}:subtitle`, 0.2)}
                contentStyle={{ color: 'var(--ops-cyan-bright)' }}
              >
                {subtitle}
              </ForgeFlowText>
            </span>
          ) : null}
        </h1>
      )}

      <ForgeDecodeText
        as="p"
        className="forge-hint forge-page-lead"
        layout="block"
        animateId={`${scope}:lead`}
        playOnce
        reserveLayout
        delay={fillDelay(`${scope}:lead`, title || subtitle ? 0.28 : 0.16)}
        duration={getForgeTextDuration(lead.length, FORGE_DECODE_HUD_OPTS)}
      >
        {lead}
      </ForgeDecodeText>
    </header>
  );
}

export default ForgeAnimatedPageHeader;
