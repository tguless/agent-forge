import { NextResponse } from 'next/server';
import { createAgent, hasAgent } from '@/lib/agentStore';
import {
  getBusiness,
  getRole,
  listRoles,
  setRoleStatus,
  setAgentBusiness,
} from '@/lib/businessStore';
import { uniqueSlug } from '@/lib/slug';
import type { AgentData } from '@/lib/types';
import type { BusinessRole } from '@/lib/businessTypes';
import {
  enqueueBusinessForge,
  getBusinessForgeQueueProgress,
  isBusinessForgeQueueActive,
} from '@/lib/server/businessForgeQueue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function prepareForgeRole(businessSlug: string, role: BusinessRole): {
  roleId: number;
  slug: string;
  roleTitle: string;
} {
  const seed = role.title || role.jobDescription.split('\n')[0] || role.businessContext;
  const slug = uniqueSlug(seed, hasAgent);
  const initial: AgentData = {
    slug,
    title: role.title || 'New Agent',
    subtitle: 'Forging…',
    department: '',
    accent: '#38bdf8',
    authority: role.authorityHint || 3,
    q1Objective: '',
    successCriteria: [],
    deliverables: [],
    skillsFile: `${slug}.skills.md`,
  };
  createAgent({
    slug,
    title: initial.title,
    data: initial,
    businessContext: role.businessContext,
    jobDescription: role.jobDescription,
  });
  setAgentBusiness(slug, businessSlug);
  setRoleStatus(role.id, 'forging', slug);
  return { roleId: role.id, slug, roleTitle: role.title || slug };
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let body: { roleId?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* no body = forge all */
  }

  const rolesToForge: BusinessRole[] = [];

  if (body.roleId != null) {
    const role = getRole(Number(body.roleId));
    if (!role || role.businessSlug !== params.slug) {
      return NextResponse.json({ error: 'role not found for this business' }, { status: 404 });
    }
    if (role.status !== 'suggested') {
      return NextResponse.json({ error: 'role is not available to forge' }, { status: 400 });
    }
    rolesToForge.push(role);
  } else {
    for (const role of listRoles(params.slug)) {
      if (role.status === 'suggested') rolesToForge.push(role);
    }
  }

  if (rolesToForge.length === 0) {
    return NextResponse.json({ queued: 0, queue: getBusinessForgeQueueProgress(params.slug) });
  }

  const existingQueue = getBusinessForgeQueueProgress(params.slug);
  const busyRoleIds = new Set(
    existingQueue?.items
      .filter((i) => i.status === 'pending' || i.status === 'running')
      .map((i) => i.roleId) ?? [],
  );
  for (const role of rolesToForge) {
    if (busyRoleIds.has(role.id)) {
      return NextResponse.json(
        { error: 'One or more roles are already queued or forging.' },
        { status: 409 },
      );
    }
  }

  const prepared = rolesToForge.map((role) => {
    const row = prepareForgeRole(params.slug, role);
    return { roleId: row.roleId, agentSlug: row.slug, roleTitle: row.roleTitle };
  });
  const result = enqueueBusinessForge(params.slug, prepared);

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Could not queue forge run.' }, { status: 409 });
  }

  return NextResponse.json({
    queued: prepared.length,
    queue: result.queue,
    forgeQueueActive: isBusinessForgeQueueActive(params.slug),
  });
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({
    queue: getBusinessForgeQueueProgress(params.slug),
    forgeQueueActive: isBusinessForgeQueueActive(params.slug),
  });
}
