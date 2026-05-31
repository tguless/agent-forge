import { NextResponse } from 'next/server';
import { getAgent, deleteAgent } from '@/lib/agentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const agent = getAgent(params.slug);
  if (!agent) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({
    slug: agent.slug,
    status: agent.status,
    data: agent.data,
    error: agent.error,
    hasSkill: agent.skillMarkdown.length > 0,
    updatedAt: agent.updatedAt,
  });
}

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  deleteAgent(params.slug);
  return NextResponse.json({ ok: true });
}
