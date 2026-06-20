'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ForgeDecodeText, ForgeFlowText, ForgeHeaderText } from '@/components/ForgeArwesText';
import { useForgeUiSettings } from '@/components/ForgeUiSettingsProvider';
import { createAnimateBlockSequence, reactNodeToPlainText } from '@/lib/forgeAnimatedText';
import type { Components } from 'react-markdown';

type ForgeMarkdownProps = {
  children: string;
  className?: string;
  /** Stagger typewriter / decode fill across markdown blocks. */
  animated?: boolean;
  /** Prefix for animateId values — should be stable for the content scope. */
  animatePrefix?: string;
  animateDelayStep?: number;
};

function buildAnimatedComponents(prefix: string, delayStep: number): Components {
  const seq = createAnimateBlockSequence(prefix, delayStep);

  const flowBlock = (
    Tag: keyof HTMLElementTagNameMap,
    className: string,
    kind: string,
    children: React.ReactNode,
  ) => {
    const text = reactNodeToPlainText(children).trim();
    if (!text) return React.createElement(Tag, { className }, children);
    const { animateId, delay } = seq.next(kind);
    return (
      <ForgeFlowText
        as={Tag}
        className={className}
        layout="block"
        playOnce
        animateId={animateId}
        delay={delay}
      >
        {text}
      </ForgeFlowText>
    );
  };

  const heading = (
    Tag: 'h1' | 'h2' | 'h3',
    className: string,
    children: React.ReactNode,
  ) => {
    const text = reactNodeToPlainText(children).trim();
    if (!text) return React.createElement(Tag, { className }, children);
    const { animateId, delay } = seq.next(Tag);
    const HeaderTag = Tag === 'h1' ? ForgeHeaderText : ForgeDecodeText;
    return (
      <HeaderTag
        as={Tag}
        className={className}
        layout="block"
        playOnce
        animateId={animateId}
        delay={delay}
        contentStyle={{ color: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
      >
        {text}
      </HeaderTag>
    );
  };

  return {
    h1: ({ children: c }) => heading('h1', 'ops-skills-h1', c),
    h2: ({ children: c }) => heading('h2', 'ops-skills-h2', c),
    h3: ({ children: c }) => heading('h3', 'ops-skills-h3', c),
    p: ({ children: c }) => flowBlock('p', 'ops-skills-p', 'p', c),
    li: ({ children: c }) => flowBlock('li', 'ops-skills-li', 'li', c),
    ul: ({ children: c }) => <ul className="ops-skills-ul">{c}</ul>,
    ol: ({ children: c }) => <ol className="ops-skills-ol">{c}</ol>,
    code: ({ className: cn, children: c }) =>
      cn ? (
        <code className={`ops-skills-code ${cn}`}>{c}</code>
      ) : (
        <code className="ops-skills-code">{c}</code>
      ),
    pre: ({ children: c }) => <pre className="ops-skills-pre">{c}</pre>,
    strong: ({ children: c }) => <strong className="ops-skills-strong">{c}</strong>,
    table: ({ children: c }) => (
      <div className="ops-skills-table-wrap">
        <table className="ops-skills-table">{c}</table>
      </div>
    ),
    thead: ({ children: c }) => <thead className="ops-skills-thead">{c}</thead>,
    tbody: ({ children: c }) => <tbody className="ops-skills-tbody">{c}</tbody>,
    tr: ({ children: c }) => <tr className="ops-skills-tr">{c}</tr>,
    // Table cells must stay native table-cell; block ARWES wrappers break column layout.
    th: ({ children: c }) => <th className="ops-skills-th">{c}</th>,
    td: ({ children: c }) => <td className="ops-skills-td">{c}</td>,
  };
}

const STATIC_COMPONENTS: Components = {
  h1: ({ children: c }) => <h1 className="ops-skills-h1">{c}</h1>,
  h2: ({ children: c }) => <h2 className="ops-skills-h2">{c}</h2>,
  h3: ({ children: c }) => <h3 className="ops-skills-h3">{c}</h3>,
  p: ({ children: c }) => <p className="ops-skills-p">{c}</p>,
  ul: ({ children: c }) => <ul className="ops-skills-ul">{c}</ul>,
  ol: ({ children: c }) => <ol className="ops-skills-ol">{c}</ol>,
  li: ({ children: c }) => <li className="ops-skills-li">{c}</li>,
  code: ({ className: cn, children: c }) =>
    cn ? (
      <code className={`ops-skills-code ${cn}`}>{c}</code>
    ) : (
      <code className="ops-skills-code">{c}</code>
    ),
  pre: ({ children: c }) => <pre className="ops-skills-pre">{c}</pre>,
  strong: ({ children: c }) => <strong className="ops-skills-strong">{c}</strong>,
  table: ({ children: c }) => (
    <div className="ops-skills-table-wrap">
      <table className="ops-skills-table">{c}</table>
    </div>
  ),
  thead: ({ children: c }) => <thead className="ops-skills-thead">{c}</thead>,
  tbody: ({ children: c }) => <tbody className="ops-skills-tbody">{c}</tbody>,
  tr: ({ children: c }) => <tr className="ops-skills-tr">{c}</tr>,
  th: ({ children: c }) => <th className="ops-skills-th">{c}</th>,
  td: ({ children: c }) => <td className="ops-skills-td">{c}</td>,
};

/** Shared GFM markdown renderer — same engine/styles as the agent skill module overlay. */
export function ForgeMarkdown({
  children,
  className,
  animated = false,
  animatePrefix,
  animateDelayStep = 0.05,
}: ForgeMarkdownProps) {
  const { ui } = useForgeUiSettings();
  const useAnimated = animated && ui.markdownTextFillEnabled;
  const prefix =
    animatePrefix ??
    (useAnimated ? `md:${children.length}:${children.slice(0, 40)}` : undefined);

  const components = React.useMemo(() => {
    if (!useAnimated || !prefix) return STATIC_COMPONENTS;
    return buildAnimatedComponents(prefix, animateDelayStep);
  }, [useAnimated, prefix, animateDelayStep, children]);

  return (
    <div className={className ? `forge-markdown ${className}` : 'forge-markdown'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default ForgeMarkdown;
