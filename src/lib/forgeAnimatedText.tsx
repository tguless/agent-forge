'use client';

import React from 'react';
import { ForgeDecodeText, ForgeFlowText, ForgeHeaderText } from '@/components/ForgeArwesText';

/** Flatten ReactMarkdown inline nodes to plain text for typewriter fill. */
export function reactNodeToPlainText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToPlainText).join('');
  if (React.isValidElement(node)) {
    return reactNodeToPlainText((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

export type AnimateBlockSequence = {
  next: (kind: string) => { animateId: string; delay: number };
};

/** Assign stable staggered animate ids within one mount (e.g. a tab panel). */
export function createAnimateBlockSequence(prefix: string, delayStep = 0.05): AnimateBlockSequence {
  let index = 0;
  return {
    next(kind: string) {
      const i = index++;
      return { animateId: `${prefix}:${kind}:${i}`, delay: i * delayStep };
    },
  };
}

type AnimatedFlowProps = {
  seq: AnimateBlockSequence;
  kind?: string;
  className?: string;
  as?: keyof HTMLElementTagNameMap;
  children: string;
};

export function AnimatedFlowParagraph({
  seq,
  kind = 'p',
  className,
  as = 'p',
  children,
}: AnimatedFlowProps) {
  if (!children.trim()) return null;
  const { animateId, delay } = seq.next(kind);
  return (
    <ForgeFlowText
      as={as}
      className={className}
      layout={as === 'span' ? 'inline' : 'block'}
      playOnce
      animateId={animateId}
      delay={delay}
    >
      {children}
    </ForgeFlowText>
  );
}

type AnimatedDecodeProps = {
  seq: AnimateBlockSequence;
  kind?: string;
  className?: string;
  as?: keyof HTMLElementTagNameMap;
  children: string;
  header?: boolean;
};

export function AnimatedDecodeLine({
  seq,
  kind = 'h',
  className,
  as = 'span',
  children,
  header = false,
}: AnimatedDecodeProps) {
  if (!children.trim()) return null;
  const { animateId, delay } = seq.next(kind);
  const Text = header ? ForgeHeaderText : ForgeDecodeText;
  return (
    <Text
      as={as}
      className={className}
      layout={as === 'span' ? 'inline' : 'block'}
      playOnce
      animateId={animateId}
      delay={delay}
      contentStyle={{ color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
    >
      {children}
    </Text>
  );
}
