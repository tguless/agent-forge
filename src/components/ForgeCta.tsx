'use client';

import React from 'react';
import Link from 'next/link';
import { useForgeInteractive } from '@/hooks/useForgeInteractive';

type ForgeCtaProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: 'solid' | 'ghost';
  size?: 'default' | 'sm';
};

type ForgeCtaButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'ghost';
  size?: 'default' | 'sm';
  generate?: boolean;
};

function ctaClassName(
  variant: 'solid' | 'ghost',
  size: 'default' | 'sm',
  extra?: string,
  generate?: boolean,
): string {
  return [
    'forge-cta',
    variant === 'ghost' ? 'forge-cta--ghost' : '',
    size === 'sm' ? 'forge-cta--sm' : '',
    generate ? 'forge-cta--generate' : '',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export function ForgeCtaLink({ href, variant = 'solid', size = 'default', className, children, ...props }: ForgeCtaProps) {
  const ref = React.useRef<HTMLAnchorElement>(null);
  useForgeInteractive(ref, {
    color: 'color-mix(in srgb, var(--ops-cyan-bright, #7fe7ff) 22%, transparent)',
    size: 260,
  });

  return (
    <Link
      ref={ref}
      href={href}
      className={ctaClassName(variant, size, className)}
      {...props}
    >
      {children}
    </Link>
  );
}

export function ForgeCtaButton({
  variant = 'solid',
  size = 'default',
  className,
  children,
  generate,
  type = 'button',
  ...props
}: ForgeCtaButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  useForgeInteractive(ref, {
    color: 'color-mix(in srgb, var(--ops-cyan-bright, #7fe7ff) 22%, transparent)',
    size: 260,
  });

  return (
    <button
      ref={ref}
      type={type}
      className={ctaClassName(variant, size, className, generate)}
      {...props}
    >
      {children}
    </button>
  );
}
