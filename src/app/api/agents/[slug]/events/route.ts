import { NextResponse } from 'next/server';
import { getAgent, listEvents } from '@/lib/agentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const agent = getAgent(params.slug);
  if (!agent) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const after = Number(new URL(req.url).searchParams.get('after') ?? 0);
  return NextResponse.json({
    status: agent.status,
    error: agent.error,
    events: listEvents(params.slug, Number.isFinite(after) ? after : 0),
  });
}
