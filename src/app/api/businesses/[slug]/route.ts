import { NextResponse } from 'next/server';
import {
  getBusiness,
  listRoles,
  listBusinessApps,
  listAgentsByBusiness,
} from '@/lib/businessStore';
import { listAppTypes, listCapacities } from '@/lib/catalogStore';
import { isConsultInFlight, isPlanGenerationInFlight } from '@/lib/server/businessRunLock';
import {
  businessPlanHasContent,
  businessPlanIsComplete,
} from '@/lib/businessPlanSections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });

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
    hasBusinessPlan: businessPlanHasContent(business.profile.businessPlan),
    planComplete: businessPlanIsComplete(business.profile.businessPlan),
    roles: listRoles(params.slug),
    appStack,
    agents: listAgentsByBusiness(params.slug),
    capacities: listCapacities(),
  });
}
