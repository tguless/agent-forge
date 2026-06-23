import { NextResponse } from 'next/server';
import {
  resolveEditableSection,
  writeEditableSection,
} from '@/lib/server/editableSectionService';
import {
  appendTextSectionVersion,
  listTextSectionVersions,
} from '@/lib/server/textSectionVersionHistory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string; path: string[] }> };

/** GET: current content + version history for any editable section. */
export async function GET(_req: Request, ctx: Params) {
  const { slug, path } = await ctx.params;
  const section = resolveEditableSection(slug, path);
  if (!section) return NextResponse.json({ error: 'Invalid section' }, { status: 400 });

  return NextResponse.json({
    path: section.path,
    label: section.label,
    kind: section.kind,
    currentContent: section.content,
    canRewrite: section.canRewrite,
    versions: listTextSectionVersions(slug, path),
  });
}

/** PATCH: manual edit of any editable section. */
export async function PATCH(req: Request, ctx: Params) {
  const { slug, path } = await ctx.params;
  const section = resolveEditableSection(slug, path);
  if (!section) return NextResponse.json({ error: 'Invalid section' }, { status: 400 });

  const body = (await req.json()) as { content: string };
  if (body.content === undefined || body.content === null) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const ok = writeEditableSection(slug, path, body.content);
  if (!ok) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });

  const version = appendTextSectionVersion(slug, path, {
    content: body.content.trim(),
    source: 'user_edit',
  });

  return NextResponse.json({ ok: true, version: version.version });
}
