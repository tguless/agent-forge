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

type Params = { params: Promise<{ slug: string; sectionKey: string }> };

/** Legacy plan-section route — delegates to unified sections API. */
export async function GET(_req: Request, ctx: Params) {
  const { slug, sectionKey } = await ctx.params;
  const path = ['plan', sectionKey];
  const section = resolveEditableSection(slug, path);
  if (!section) return NextResponse.json({ error: 'Invalid section key' }, { status: 400 });

  return NextResponse.json({
    sectionKey,
    sectionLabel: section.label,
    currentContent: section.content,
    versions: listTextSectionVersions(slug, path),
  });
}

export async function PATCH(req: Request, ctx: Params) {
  const { slug, sectionKey } = await ctx.params;
  const path = ['plan', sectionKey];
  const section = resolveEditableSection(slug, path);
  if (!section) return NextResponse.json({ error: 'Invalid section key' }, { status: 400 });

  const body = (await req.json()) as { content: string };
  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  writeEditableSection(slug, path, body.content);
  const version = appendTextSectionVersion(slug, path, {
    content: body.content.trim(),
    source: 'user_edit',
  });

  return NextResponse.json({ ok: true, version: version.version });
}
