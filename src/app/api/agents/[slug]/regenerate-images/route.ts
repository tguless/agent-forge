import { NextResponse } from 'next/server';
import { addEvent, getAgent, patchAgentData } from '@/lib/agentStore';
import { generateAgentImage, type ImageKind } from '@/lib/server/imagePipeline';
import type { AgentData } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function deriveSubjects(data: AgentData): Record<ImageKind, string> {
  const role = data.role || data.title;
  const focus = data.focus ? `, focus on ${data.focus}` : '';
  return {
    icon: `flat vector HUD glyph: one bold symbol for ${role}${focus}`,
    emblem: `large polished metal sculpture of the single dominant object for ${role}${focus} — that object is the only center symbol inside the winged badge`,
    portrait: `${data.callsign ?? 'Commander'} tactical commander for ${role}${focus}, ${data.accent} gear`,
  };
}

/** Re-run Gemini image pipeline for an existing agent (repair missing/broken assets). */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const agent = getAgent(slug);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const subjects = deriveSubjects(agent.data);
  const accent = agent.data.accent || '#38bdf8';
  const authority = agent.data.authority ?? 3;
  const results: Record<string, unknown> = {};

  for (const kind of ['emblem', 'portrait', 'icon'] as const) {
    addEvent(slug, 'image', `Regenerating ${kind}…`);
    const result = await generateAgentImage({
      slug,
      kind,
      subject: subjects[kind],
      accent,
      authority,
    });
    const field = kind === 'icon' ? 'iconPath' : kind === 'emblem' ? 'emblemPath' : 'portraitPath';
    patchAgentData(slug, { [field]: result.webPath });
    addEvent(
      slug,
      result.generated ? 'image' : 'warn',
      `${kind}: ${result.generated ? 'generated' : 'placeholder'}${result.notes.length ? ` — ${result.notes.join(' ')}` : ''}`,
    );
    results[kind] = { generated: result.generated, webPath: result.webPath, notes: result.notes };
  }

  return NextResponse.json({ slug, results });
}
