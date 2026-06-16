import { NextResponse } from 'next/server';
import { getBusiness } from '@/lib/businessStore';
import { marketAssessmentIsComplete } from '@/lib/marketAssessment';
import {
  activeBusinessRunKind,
  isAnyBusinessRunInFlight,
} from '@/lib/server/businessRunLock';
import { startMarketAssessment } from '@/lib/server/marketAssessmentRunner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (marketAssessmentIsComplete(business.profile.marketAssessment)) {
    return NextResponse.json({ error: 'Market assessment is already complete.' }, { status: 400 });
  }

  if (isAnyBusinessRunInFlight(params.slug)) {
    const kind = activeBusinessRunKind(params.slug);
    const message =
      kind === 'consult'
        ? 'Blueprint consult is in progress — wait for it to finish before generating a market assessment.'
        : 'Another agent run is in progress for this business.';
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const started = startMarketAssessment(params.slug);
  if (!started) {
    return NextResponse.json(
      { error: 'Could not start market assessment — another run may have just started.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ started: true, slug: params.slug });
}
