import { NextResponse } from 'next/server';
import { addEvent, getAgent, patchAgentData } from '@/lib/agentStore';
import { generateAgentImage, type ImageKind } from '@/lib/server/imagePipeline';
import type { AgentData } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PaperIQ operations pattern: one concrete metal center sculpture, not a flat HUD layout. */
function deriveEmblemSubject(data: AgentData): string {

  const combined = `${data.role ?? ''} ${data.title ?? ''} ${data.focus ?? ''}`.toLowerCase();
  if (/lease|abstract|contract|extract|document/.test(combined)) {
    return 'large magnifying glass over stacked lease document pages in polished metal — magnifying glass is the only center symbol';
  }
  if (/patent|prior art|research/.test(combined)) {
    return 'large magnifying glass with thick circular lens and handle in metal — magnifying glass is the only center symbol';
  }
  if (/sales|prospect|outbound|pipeline/.test(combined)) {
    return 'large paper airplane pointing up-right in metal — paper airplane is the only center symbol';
  }
  if (/growth|acquisition|marketing|seo|content/.test(combined)) {
    return 'large upward trending line chart with bold arrow tip in metal — growth chart is the only center symbol';
  }
  if (/security|audit|compliance|risk/.test(combined)) {
    return 'large crosshair target reticle circle with cross lines in metal — crosshair is the only center symbol';
  }
  const role = data.role || data.title || 'this agent';
  return `large polished metal sculpture of the single dominant object for ${role} — that object is the only center symbol`;
}

function deriveSubjects(data: AgentData): Record<ImageKind, string> {
  const role = data.role || data.title;
  const focus = data.focus ? `, focus on ${data.focus}` : '';
  return {
    icon:
      data.iconSubject?.trim() ||
      `flat vector HUD glyph: one bold symbol for ${role}${focus}`,
    emblem: data.emblemSubject?.trim() || deriveEmblemSubject(data),
    portrait:
      data.portraitSubject?.trim() ||
      `${data.callsign ?? 'Commander'} tactical commander for ${role}${focus}, ${data.accent} gear`,
  };
}

/** Re-run Gemini image pipeline for an existing agent (repair missing/broken assets). */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const agent = getAgent(slug);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  let kinds: ImageKind[] = ['emblem', 'portrait', 'icon'];
  const raw = await req.text();
  if (raw.trim()) {
    try {
      const body = JSON.parse(raw) as { kinds?: unknown };
      if (Array.isArray(body.kinds) && body.kinds.length > 0) {
        kinds = body.kinds.filter(
          (k): k is ImageKind => k === 'icon' || k === 'emblem' || k === 'portrait',
        );
        if (kinds.length === 0) {
          return NextResponse.json({ error: 'Invalid kinds — use icon, emblem, and/or portrait.' }, { status: 400 });
        }
      }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  }

  const subjects = deriveSubjects(agent.data);
  const accent = agent.data.accent || '#38bdf8';
  const authority = agent.data.authority ?? 3;
  const results: Record<string, unknown> = {};

  for (const kind of kinds) {
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
