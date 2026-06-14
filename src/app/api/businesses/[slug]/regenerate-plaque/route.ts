import { NextResponse } from 'next/server';
import { getBusiness, patchBusinessProfile } from '@/lib/businessStore';
import {
  buildPlaqueBusinessContext,
  derivePlaqueSubject,
  plaqueAccent,
} from '@/lib/businessPlaqueMotif';
import { generateBusinessPlaque } from '@/lib/server/imagePipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Re-run Gemini business identity plaque generation. */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const started = Date.now();
  console.log(`[regenerate-plaque] start slug=${slug}`);

  const business = getBusiness(slug);
  if (!business) {
    console.warn(`[regenerate-plaque] not found slug=${slug}`);
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const accent = plaqueAccent(business.slug);
  const subject = derivePlaqueSubject(business);
  console.log(`[regenerate-plaque] slug=${slug} subject=${subject.slice(0, 120)}…`);

  const result = await generateBusinessPlaque({
    slug,
    subject,
    accent,
    businessName: business.name,
    businessContext: buildPlaqueBusinessContext(business),
  });

  patchBusinessProfile(slug, {
    plaquePath: result.webPath,
    plaqueSubject: subject,
  });

  console.log(
    `[regenerate-plaque] done slug=${slug} generated=${result.generated} path=${result.webPath} ms=${Date.now() - started}${result.notes.length ? ` notes=${result.notes.join('; ')}` : ''}`,
  );

  return NextResponse.json({
    slug,
    plaque: {
      generated: result.generated,
      webPath: result.webPath,
      notes: result.notes,
      cacheBust: Date.now(),
    },
  });
}
