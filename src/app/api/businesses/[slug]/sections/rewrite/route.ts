import { NextResponse } from 'next/server';
import { runSectionRewrite } from '@/lib/server/sectionRewriteRunner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Params = { params: Promise<{ slug: string }> };

/** POST body includes path segments since catch-all cannot have /rewrite suffix. */
export async function POST(req: Request, ctx: Params) {
  const { slug } = await ctx.params;
  const body = (await req.json()) as { path: string[]; instructions: string };
  if (!Array.isArray(body.path) || body.path.length === 0) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }
  return runSectionRewrite(slug, body.path, body.instructions ?? '');
}
