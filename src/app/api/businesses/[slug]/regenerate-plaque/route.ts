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
  const business = getBusiness(slug);
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  const accent = plaqueAccent(business.slug);
  const subject = derivePlaqueSubject(business);

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

  return NextResponse.json({
    slug,
    plaque: {
      generated: result.generated,
      webPath: result.webPath,
      notes: result.notes,
    },
  });
}
