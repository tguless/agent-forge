'use client';

import React from 'react';
import type { Animation, Easing } from '@arwes/animated';
import {
  animateTextDecipherInPlace,
  animateTextSequenceInPlace,
  FORGE_DECODE_DURATION_OPTS,
  getForgeTextDuration,
  lockElementLayout,
} from '@/lib/forgeArwesAnimate';
import { useForgeUiSettings } from '@/components/ForgeUiSettingsProvider';
import {
  registerPendingForgeTextReadout,
  unregisterPendingForgeTextReadout,
} from '@/lib/forgeBleeps';

/**
 * Forge text animation variants:
 *
 * - **header** — Header reveal: fast typewriter + cursor. Titles and agent names only.
 * - **flow** — Flow: quote-style typewriter + cursor. Prose inside HUD boxes (objectives,
 *   quotes, mission text, outcome copy). Same animation as the agent quote panel.
 * - **decode** — Decode: glyph scramble fill-in. Telemetry (logs, queue status, short labels).
 *
 * Explicit `manager` overrides `variant`.
 */
type ForgeTextVariant = 'header' | 'flow' | 'decode' | 'body';

type ForgeArwesTextProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  variant?: ForgeTextVariant;
  manager?: 'sequence' | 'decipher';
  duration?: number;
  blink?: boolean;
  easing?: Easing;
  as?: keyof HTMLElementTagNameMap;
  layout?: 'inline' | 'block';
  /** Stable id for play-once dedupe within this mount (include content fingerprint when copy can change). */
  animateId?: string;
  /** Skip re-animation when this id already played on the current mount (e.g. roster poll). */
  playOnce?: boolean;
  /** Lock block height before sequence animation so parents (e.g. agent cards) do not grow. */
  reserveLayout?: boolean;
  /** ARWES type readout while text fills in. */
  readoutSound?: boolean;
  /** Delay before animation starts (seconds). Use for staggering card reveals. */
  delay?: number;
};

const PHRASING_ONLY_HOSTS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'a',
  'label',
  'strong',
  'em',
]);

/** Block layout inside <p> etc. must use span+display:block — div inside p is invalid HTML. */
function resolveContentTag(hostTag: keyof HTMLElementTagNameMap, layout: 'inline' | 'block'): 'span' | 'div' {
  if (layout === 'inline') return 'span';
  if (PHRASING_ONLY_HOSTS.has(hostTag)) return 'span';
  return 'div';
}

function resolveContentStyle(
  hostTag: keyof HTMLElementTagNameMap,
  layout: 'inline' | 'block',
  contentStyle?: React.CSSProperties,
): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: 'var(--ops-font-ui)',
    color: 'var(--ops-text, #f8fafc)',
    ...contentStyle,
  };
  if (layout === 'block' && resolveContentTag(hostTag, layout) === 'span') {
    return { ...base, display: 'block', width: '100%' };
  }
  return base;
}

function resolvesToSequence(
  variant: ForgeArwesTextProps['variant'],
  manager: ForgeArwesTextProps['manager'],
): boolean {
  if (manager) return manager === 'sequence';
  if (variant === 'decode' || variant === 'body') return false;
  return true;
}

function resolveStackTag(hostTag: keyof HTMLElementTagNameMap): 'span' | 'div' {
  if (PHRASING_ONLY_HOSTS.has(hostTag)) return 'span';
  return 'div';
}

function resolveAnimation(
  variant: ForgeArwesTextProps['variant'],
  manager: ForgeArwesTextProps['manager'],
  blink: boolean | undefined,
  duration: number | undefined,
  textLength: number,
): { manager: 'sequence' | 'decipher'; blink: boolean; duration: number } {
  if (manager) {
    return {
      manager,
      blink: blink ?? manager === 'sequence',
      duration:
        duration ??
        (manager === 'sequence'
          ? 1.1
          : getForgeTextDuration(textLength, FORGE_DECODE_DURATION_OPTS)),
    };
  }
  if (variant === 'header') {
    return { manager: 'sequence', blink: blink ?? true, duration: duration ?? 0.9 };
  }
  if (variant === 'flow') {
    return {
      manager: 'sequence',
      blink: blink ?? true,
      duration: duration ?? getForgeTextDuration(textLength, { max: 2.5, min: 0.6, charactersPerSecond: 80 }),
    };
  }
  if (variant === 'decode' || variant === 'body') {
    return {
      manager: 'decipher',
      blink: false,
      duration: duration ?? getForgeTextDuration(textLength, FORGE_DECODE_DURATION_OPTS),
    };
  }
  // Default: flow (quote / box prose style)
  return {
    manager: 'sequence',
    blink: blink ?? true,
    duration: duration ?? getForgeTextDuration(textLength, { max: 2.5, min: 0.6, charactersPerSecond: 80 }),
  };
}

export function ForgeArwesText({
  children,
  className,
  contentClassName,
  contentStyle,
  variant,
  manager,
  duration,
  blink,
  easing,
  as: Tag = 'span',
  layout = 'inline',
  animateId,
  playOnce = false,
  reserveLayout = true,
  readoutSound = true,
  delay,
}: ForgeArwesTextProps) {
  const contentRef = React.useRef<HTMLElement>(null);
  const animRef = React.useRef<Animation | null>(null);
  const delayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Per-instance play-once — resets when the component unmounts (e.g. leave and return to a page). */
  const playedIdRef = React.useRef<string | null>(null);
  const ContentTag = resolveContentTag(Tag, layout);
  const useStack = reserveLayout;
  const StackTag = resolveStackTag(Tag);
  const { textFillSoundsEnabled, typeReadoutStopRatio } = useForgeUiSettings();
  const useReadoutSound = readoutSound && textFillSoundsEnabled;

  React.useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content || !content.textContent?.length) return;

    const resolved = resolveAnimation(variant, manager, blink, duration, content.textContent.length);
    const resolvedEasing = easing ?? (resolved.manager === 'decipher' ? 'linear' : 'outExpo');
    const id =
      animateId ??
      `${resolved.manager}:${variant ?? 'default'}:${layout}:${content.textContent.length}:${content.textContent.slice(0, 48)}`;

    if (useStack) {
      const stack = content?.closest('.forge-arwes-text__stack') as HTMLElement | null;
      if (stack) lockElementLayout(stack);
    }

    if (playOnce && playedIdRef.current === id) {
      return;
    }

    animRef.current?.cancel();

    const run = () => {
      const anim =
        resolved.manager === 'decipher'
          ? animateTextDecipherInPlace({
              contentElement: content,
              duration: resolved.duration,
              easing: resolvedEasing,
              readoutSound: useReadoutSound,
              readoutStopRatio: typeReadoutStopRatio,
            })
          : animateTextSequenceInPlace({
              contentElement: content,
              duration: resolved.duration,
              easing: resolvedEasing,
              blink: resolved.blink,
              readoutSound: useReadoutSound,
              readoutStopRatio: typeReadoutStopRatio,
            });

      animRef.current = anim;

      void anim.then(() => {
        if (playOnce) {
          playedIdRef.current = id;
        }
      });
    };

    if (delay && delay > 0) {
      content.style.visibility = 'hidden';
      if (useReadoutSound) {
        registerPendingForgeTextReadout();
      }
      delayRef.current = setTimeout(() => {
        delayRef.current = null;
        if (useReadoutSound) {
          unregisterPendingForgeTextReadout();
        }
        content.style.visibility = '';
        run();
      }, delay * 1000);
    } else {
      run();
    }

    return () => {
      if (delayRef.current) {
        clearTimeout(delayRef.current);
        delayRef.current = null;
        if (useReadoutSound) {
          unregisterPendingForgeTextReadout();
        }
        if (contentRef.current) contentRef.current.style.visibility = '';
      }
      animRef.current?.cancel();
      animRef.current = null;
    };
  }, [variant, manager, duration, blink, easing, layout, animateId, playOnce, reserveLayout, readoutSound, delay, textFillSoundsEnabled, typeReadoutStopRatio, useReadoutSound]);

  const layoutClass = layout === 'block' ? 'forge-arwes-text--block' : 'forge-arwes-text--inline';
  const hostClassName = ['forge-arwes-text', layoutClass, className].filter(Boolean).join(' ');
  const contentClass = contentClassName
    ? `forge-arwes-text__content ${contentClassName}`
    : 'forge-arwes-text__content';
  const contentStyleResolved = resolveContentStyle(Tag, layout, contentStyle);

  if (useStack) {
    return React.createElement(
      Tag,
      { className: hostClassName },
      React.createElement(
        StackTag,
        { className: 'forge-arwes-text__stack' },
        React.createElement(
          ContentTag,
          {
            className: `forge-arwes-text__sizer ${contentClass}`,
            style: contentStyleResolved,
            'aria-hidden': true,
          },
          children,
        ),
        React.createElement(
          ContentTag,
          {
            ref: contentRef,
            className: contentClass,
            style: contentStyleResolved,
          },
          children,
        ),
      ),
    );
  }

  return React.createElement(
    Tag,
    { className: hostClassName },
    React.createElement(
      ContentTag,
      {
        ref: contentRef,
        className: contentClass,
        style: contentStyleResolved,
      },
      children,
    ),
  );
}

export function ForgeArwesProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Header reveal — typewriter for titles and agent names. */
export function ForgeHeaderText(props: Omit<ForgeArwesTextProps, 'variant' | 'manager'>) {
  return <ForgeArwesText {...props} variant="header" />;
}

/** Flow — quote-style typewriter for prose inside HUD boxes. */
export function ForgeFlowText(props: Omit<ForgeArwesTextProps, 'variant' | 'manager'>) {
  return <ForgeArwesText {...props} variant="flow" />;
}

/** Decode — glyph fill-in for logs, queue status, short telemetry labels. */
export function ForgeDecodeText(props: Omit<ForgeArwesTextProps, 'variant' | 'manager'>) {
  return <ForgeArwesText {...props} variant="decode" />;
}

/** @deprecated Use ForgeDecodeText */
export const ForgeBodyText = ForgeDecodeText;

export default ForgeArwesText;
