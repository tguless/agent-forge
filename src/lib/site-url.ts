/** Canonical public origin (no trailing slash). Used for metadataBase and absolute OG URLs. */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agent.paperiq.ai';
  return url.replace(/\/$/, '');
}

export function absoluteUrl(pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getSiteUrl()}${normalized}`;
}
