/** Make a URL/file-safe slug from arbitrary text. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Append -2, -3, ... until `taken(slug)` is false. */
export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  const root = slugify(base) || 'agent';
  if (!taken(root)) return root;
  let n = 2;
  while (taken(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}
