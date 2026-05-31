import { NextResponse } from 'next/server';
import { createAgent, hasAgent } from '@/lib/agentStore';
import { runGeneration } from '@/lib/server/agentRunner';
import { uniqueSlug } from '@/lib/slug';
import type { AgentData } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { businessContext?: string; jobDescription?: string; titleHint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const businessContext = (body.businessContext ?? '').trim();
  const jobDescription = (body.jobDescription ?? '').trim();
  const titleHint = (body.titleHint ?? '').trim();

  if (!businessContext) {
    return NextResponse.json({ error: 'businessContext is required' }, { status: 400 });
  }

  const seed = titleHint || jobDescription.split('\n')[0] || businessContext;
  const slug = uniqueSlug(seed, hasAgent);

  const initial: AgentData = {
    slug,
    title: titleHint || 'New Agent',
    subtitle: 'Forging…',
    department: '',
    accent: '#38bdf8',
    authority: 3,
    q1Objective: '',
    successCriteria: [],
    deliverables: [],
    skillsFile: `${slug}.skills.md`,
  };

  createAgent({ slug, title: initial.title, data: initial, businessContext, jobDescription });

  // Fire-and-forget: the loop updates the DB; the client polls /events + detail.
  void runGeneration(slug).catch((err) => {
    // runGeneration already records errors to the DB; this guards the unhandled rejection.
    console.error('runGeneration crashed', err);
  });

  return NextResponse.json({ slug });
}
