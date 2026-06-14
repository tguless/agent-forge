import { NextResponse } from 'next/server';
import { getBusiness } from '@/lib/businessStore';
import { isConsultInFlight } from '@/lib/server/businessRunner';
import { turnStreamResponse } from '@/lib/server/turnStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const after = Number(new URL(req.url).searchParams.get('after') ?? 0);
  const isTerminal = () => {
    if (isConsultInFlight(params.slug)) return false;
    const b = getBusiness(params.slug);
    return !b || b.status === 'ready' || b.status === 'error';
  };
  return turnStreamResponse('business', params.slug, isTerminal, Number.isFinite(after) ? after : 0);
}
