import { NextResponse } from 'next/server';
import { getBusiness } from '@/lib/businessStore';
import { isConsultInFlight } from '@/lib/server/businessRunLock';
import { listTurns } from '@/lib/agent/turns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Polling fallback / replay for the consulting timeline. */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const after = Number(new URL(req.url).searchParams.get('after') ?? 0);
  return NextResponse.json({
    status: business.status,
    error: business.error,
    inFlight: isConsultInFlight(params.slug),
    turns: listTurns('business', params.slug, Number.isFinite(after) ? after : 0),
  });
}
