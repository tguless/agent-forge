'use client';

import React from 'react';
import type { ForgePageFrame, ForgePageTheme } from '@/lib/forgeLayout';

export type ForgePageShellProps = {
  /** Blue dashboard grid vs green tactical detail theme. */
  theme?: ForgePageTheme;
  /** hud = framed roster shell; detail = tactical shell; body = max-width column only. */
  frame?: ForgePageFrame;
  nav?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pageClassName?: string;
  shellClassName?: string;
  style?: React.CSSProperties;
};

/** Shared page chrome — one place for width, gutters, and shell frames. */
export function ForgePageShell({
  theme = 'dashboard',
  frame = 'body',
  nav,
  footer,
  children,
  className,
  pageClassName,
  shellClassName,
  style,
}: ForgePageShellProps) {
  const pageClass = [
    theme === 'detail' ? 'ops-detail-page' : 'ops-dashboard',
    pageClassName,
  ]
    .filter(Boolean)
    .join(' ');

  if (frame === 'hud') {
    return (
      <div className={pageClass} style={style}>
        {nav}
        <div
          className={['ops-hud-shell', 'forge-page-shell', shellClassName, className]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="ops-hf-corner ops-hf-corner-tl" aria-hidden />
          <span className="ops-hf-corner ops-hf-corner-tr" aria-hidden />
          <div className="ops-hud-inner">{children}</div>
          {footer}
        </div>
      </div>
    );
  }

  if (frame === 'detail') {
    return (
      <div className={pageClass} style={style}>
        <div className={['ops-detail-shell', 'forge-page-shell', shellClassName].filter(Boolean).join(' ')}>
          <span className="ops-detail-corner ops-detail-corner-tl" aria-hidden />
          <span className="ops-detail-corner ops-detail-corner-tr" aria-hidden />
          <span className="ops-detail-corner ops-detail-corner-bl" aria-hidden />
          <span className="ops-detail-corner ops-detail-corner-br" aria-hidden />
          <div className={['ops-detail-inner', className].filter(Boolean).join(' ')}>
            {nav}
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageClass} style={style}>
      {nav}
      <div className={['forge-page-body', className].filter(Boolean).join(' ')}>{children}</div>
    </div>
  );
}

export type ForgePageHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

/** Centered title block inside HUD / body pages. */
export function ForgePageHeader({ children, className }: ForgePageHeaderProps) {
  return (
    <header className={['forge-page-header', className].filter(Boolean).join(' ')}>{children}</header>
  );
}

export type ForgePageSectionProps = {
  children: React.ReactNode;
  className?: string;
};

/** Max-width content band (alerts, secondary panels below a detail card). */
export function ForgePageSection({ children, className }: ForgePageSectionProps) {
  return (
    <div className={['forge-page-section', className].filter(Boolean).join(' ')}>{children}</div>
  );
}

export default ForgePageShell;
