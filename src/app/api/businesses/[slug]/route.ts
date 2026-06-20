import { NextResponse } from 'next/server';
import {
  deleteBusiness,
  getBusiness,
  listRoles,
  listBusinessApps,
  listAgentsByBusiness,
  reconcileRoleForgeStatuses,
} from '@/lib/businessStore';
import { cancelRun } from '@/lib/agent/runRegistry';
import { listAppTypes, listCapacities } from '@/lib/catalogStore';
import { isConsultInFlight, isPlanGenerationInFlight, releaseBusinessRun } from '@/lib/server/businessRunLock';
import {
  clearBusinessForgeQueue,
  getBusinessForgeQueueProgress,
  isBusinessForgeQueueActive,
} from '@/lib/server/businessForgeQueue';
import {
  businessPlanHasContent,
  businessPlanIsComplete,
} from '@/lib/businessPlanSections';
import {
  marketAssessmentHasContent,
  marketAssessmentIsComplete,
} from '@/lib/marketAssessment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });

  reconcileRoleForgeStatuses(params.slug);

  const businessApps = listBusinessApps(params.slug);
  const typeLabels = new Map(listAppTypes().map((t) => [t.key, t.label]));

  // Group the stack by app type (one selected + alternatives per type).
  const stackByType = new Map<string, typeof businessApps>();
  for (const ba of businessApps) {
    const list = stackByType.get(ba.appTypeKey) ?? [];
    list.push(ba);
    stackByType.set(ba.appTypeKey, list);
  }
  const appStack = Array.from(stackByType.entries()).map(([appTypeKey, options]) => ({
    appTypeKey,
    appTypeLabel: typeLabels.get(appTypeKey) ?? appTypeKey,
    selectedAppId: options.find((o) => o.isSelected)?.appId ?? null,
    options,
  }));

  return NextResponse.json({
    business,
    consultInFlight: isConsultInFlight(params.slug),
    planInFlight: isPlanGenerationInFlight(params.slug),
    forgeQueueActive: isBusinessForgeQueueActive(params.slug),
    forgeQueue: getBusinessForgeQueueProgress(params.slug),
    hasBusinessPlan: businessPlanHasContent(business.profile.businessPlan),
    planComplete: businessPlanIsComplete(business.profile.businessPlan),
    hasMarketAssessment: marketAssessmentHasContent(business.profile.marketAssessment),
    marketComplete: marketAssessmentIsComplete(business.profile.marketAssessment),
    roles: listRoles(params.slug),
    appStack,
    agents: listAgentsByBusiness(params.slug),
    capacities: listCapacities(),
  });
}

export async function DELETE(req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });

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

  cancelRun('business', params.slug);
  cancelRun('business-plan', params.slug);
  releaseBusinessRun(params.slug, 'consult');
  releaseBusinessRun(params.slug, 'plan');
  clearBusinessForgeQueue(params.slug);

  try {
    const ok = deleteBusiness(params.slug);
    if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, slug: params.slug });
}
