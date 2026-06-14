import { NextResponse } from 'next/server';
import { getBusiness } from '@/lib/businessStore';
import { businessPlanIsComplete } from '@/lib/businessPlanSections';
import {
  activeBusinessRunKind,
  isAnyBusinessRunInFlight,
} from '@/lib/server/businessRunLock';
import { startBusinessPlanGeneration } from '@/lib/server/businessPlanRunner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (businessPlanIsComplete(business.profile.businessPlan)) {
    return NextResponse.json({ error: 'Business plan is already complete.' }, { status: 400 });
  }

  if (isAnyBusinessRunInFlight(params.slug)) {
    const kind = activeBusinessRunKind(params.slug);
    const message =
      kind === 'consult'
        ? 'Blueprint consult is in progress — wait for it to finish before generating a plan.'
        : kind === 'plan'
          ? 'Plan generation is already running.'
          : 'Another agent run is in progress for this business.';
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const started = startBusinessPlanGeneration(params.slug);
  if (!started) {
    return NextResponse.json(
      { error: 'Could not start plan generation — another run may have just started.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ started: true, slug: params.slug });
}
