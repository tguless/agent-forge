import { NextResponse } from 'next/server';
import { getBusiness } from '@/lib/businessStore';
import { businessPlanIsComplete } from '@/lib/businessPlanSections';
import { isPlanGenerationInFlight } from '@/lib/server/businessRunLock';
import { turnStreamResponse } from '@/lib/server/turnStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const after = Number(new URL(req.url).searchParams.get('after') ?? 0);
  const isTerminal = () => {
    if (isPlanGenerationInFlight(params.slug)) return false;
    const b = getBusiness(params.slug);
    return !b || businessPlanIsComplete(b.profile.businessPlan);
  };
  return turnStreamResponse(
    'business-plan',
    params.slug,
    isTerminal,
    Number.isFinite(after) ? after : 0,
  );
}
