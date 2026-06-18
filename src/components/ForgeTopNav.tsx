'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ForgeCtaLink } from '@/components/ForgeCta';
import { ForgeBackAgents, ForgeBackBusinesses } from '@/components/ForgeBackButton';

export type ForgeTopNavVariant = 'dashboard' | 'form' | 'detail';

export type ForgeTopNavBack = 'none' | 'agents' | 'businesses' | React.ReactNode;

export type ForgeTopNavProps = {
  variant?: ForgeTopNavVariant;
  /** Back control on the left; inferred from route when omitted. */
  back?: ForgeTopNavBack;
  /** Home-only left slot (replaces back). */
  pitch?: React.ReactNode;
  /** Delete buttons and other page-specific actions on the right. */
  trailing?: React.ReactNode;
  className?: string;
};

type NavLinkDef = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  primaryOnHome?: boolean;
};

const NAV_LINKS: NavLinkDef[] = [
  {
    href: '/config',
    label: 'Configuration',
    match: (pathname) => pathname === '/config' || pathname.startsWith('/config/'),
  },
  {
    href: '/business',
    label: 'Businesses',
    match: (pathname) =>
      pathname === '/business' ||
      (pathname.startsWith('/business/') && pathname !== '/business/new'),
  },
  {
    href: '/new',
    label: '+ Forge new agent',
    match: (pathname) => pathname === '/new',
    primaryOnHome: true,
  },
  {
    href: '/business/new',
    label: '+ New business',
    match: (pathname) => pathname === '/business/new',
  },
];

function inferVariant(pathname: string): ForgeTopNavVariant {
  if (pathname.startsWith('/agent/') || /^\/business\/[^/]+$/.test(pathname)) {
    return 'detail';
  }
  if (pathname === '/' || pathname === '/config' || pathname === '/business' || pathname === '/business/new' || pathname === '/new') {
    return 'dashboard';
  }
  return 'form';
}

function inferBack(pathname: string): ForgeTopNavBack {
  if (pathname === '/') return 'none';
  if (pathname === '/business/new' || /^\/business\/[^/]+$/.test(pathname)) {
    return 'businesses';
  }
  return 'agents';
}

function renderBack(back: ForgeTopNavBack): React.ReactNode {
  if (back === 'none') return null;
  if (back === 'agents') return <ForgeBackAgents />;
  if (back === 'businesses') return <ForgeBackBusinesses />;
  return back;
}

export function ForgeTopNav({
  variant,
  back,
  pitch,
  trailing,
  className,
}: ForgeTopNavProps) {
  const pathname = usePathname() ?? '/';
  const resolvedVariant = variant ?? inferVariant(pathname);
  const resolvedBack = back ?? inferBack(pathname);
  const onHome = pathname === '/';

  const rootClass = [
    resolvedVariant === 'detail' ? 'ops-detail-toolbar' : 'forge-toolbar',
    'forge-top-nav',
    resolvedVariant === 'form' ? 'forge-toolbar--form' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav className={rootClass} aria-label="Agent Forge">
      <div className="forge-top-nav__left">
        {pitch ? <div className="forge-top-nav__pitch">{pitch}</div> : renderBack(resolvedBack)}
      </div>
      <div className="forge-top-nav__actions">
        {NAV_LINKS.map((link) => {
          const active = link.match(pathname);
          const usePrimary = link.primaryOnHome && onHome;
          return (
            <ForgeCtaLink
              key={link.href}
              href={link.href}
              variant={usePrimary ? 'solid' : 'ghost'}
              size="sm"
              className={active ? 'forge-top-nav__link--active' : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {link.label}
            </ForgeCtaLink>
          );
        })}
        {trailing}
      </div>
    </nav>
  );
}

export default ForgeTopNav;
