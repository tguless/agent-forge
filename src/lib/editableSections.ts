/** Client-safe helpers for editable blueprint sections (no server imports). */

export function sectionApiUrl(slug: string, path: string[]): string {
  return `/api/businesses/${slug}/sections/${path.map(encodeURIComponent).join('/')}`;
}

export type EditableTarget = {
  path: string[];
  label: string;
  content: string;
  canRewrite?: boolean;
};
