import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agentStore';
import { isGenerationInFlight, isGenerationStale, retryGeneration } from '@/lib/server/agentRunner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Restart a stuck or failed forge run (e.g. hung Gemini image step). */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const agent = getAgent(slug);
  if (!agent) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1' || url.searchParams.get('force') === 'true';

  if (agent.status === 'complete') {
    return NextResponse.json({ error: 'agent already complete' }, { status: 409 });
  }

  if (isGenerationInFlight(slug) && !force && !isGenerationStale(slug)) {
    return NextResponse.json({ error: 'generation already in progress' }, { status: 409 });
  }

  const result = retryGeneration(slug, { force: true });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'retry failed' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, slug, forced: force || isGenerationStale(slug) });
}
