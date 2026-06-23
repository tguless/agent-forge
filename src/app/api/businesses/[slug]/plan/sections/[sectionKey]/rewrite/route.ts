import { NextResponse } from 'next/server';
import { runSectionRewrite } from '@/lib/server/sectionRewriteRunner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Params = { params: Promise<{ slug: string; sectionKey: string }> };

/** Legacy plan-section rewrite route. */
export async function POST(req: Request, ctx: Params) {
  const { slug, sectionKey } = await ctx.params;
  const body = (await req.json()) as { instructions: string };
  return runSectionRewrite(slug, ['plan', sectionKey], body.instructions ?? '');
}
