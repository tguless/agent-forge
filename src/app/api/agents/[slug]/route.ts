import { NextResponse } from 'next/server';
import { deleteAgent, getAgent } from '@/lib/agentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const agent = getAgent(slug);
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

const DEFAULT_DELETE_PASSWORD = 'password';

export async function DELETE(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!getAgent(slug)) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let password = '';
  try {
    const body = (await req.json()) as { password?: string };
    password = String(body.password ?? '').trim();
  } catch {
    password = (req.headers.get('x-forge-delete-password') ?? '').trim();
  }
  const expected = (process.env.FORGE_DELETE_PASSWORD || 'password').trim();
  if (password !== expected) {
    return NextResponse.json({ error: 'invalid password' }, { status: 403 });
  }

  deleteAgent(slug);
  return NextResponse.json({ ok: true, slug });
}
