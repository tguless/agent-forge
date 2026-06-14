import { NextResponse } from 'next/server';
import { createAgent, hasAgent } from '@/lib/agentStore';
import {
  getBusiness,
  getRole,
  listRoles,
  setRoleStatus,
  setAgentBusiness,
} from '@/lib/businessStore';
import { startAgentGeneration } from '@/lib/server/agentRunner';
import { uniqueSlug } from '@/lib/slug';
import type { AgentData } from '@/lib/types';
import type { BusinessRole } from '@/lib/businessTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function forgeRole(businessSlug: string, role: BusinessRole): string {
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
  startAgentGeneration(slug);
  return slug;
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

  const forged: { roleId: number; slug: string }[] = [];

  if (body.roleId != null) {
    const role = getRole(Number(body.roleId));
    if (!role || role.businessSlug !== params.slug) {
      return NextResponse.json({ error: 'role not found for this business' }, { status: 404 });
    }
    forged.push({ roleId: role.id, slug: forgeRole(params.slug, role) });
  } else {
    for (const role of listRoles(params.slug)) {
      if (role.status === 'suggested') {
        forged.push({ roleId: role.id, slug: forgeRole(params.slug, role) });
      }
    }
  }

  return NextResponse.json({ forged });
}
