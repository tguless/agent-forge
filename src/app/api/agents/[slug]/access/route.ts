import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agentStore';
import { listAgentAccess } from '@/lib/accessStore';
import { getAgentBusinessSlug } from '@/lib/businessStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const agent = getAgent(params.slug);
  if (!agent) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({
    businessSlug: getAgentBusinessSlug(params.slug),
    access: listAgentAccess(params.slug),
  });
}
