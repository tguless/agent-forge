import { NextResponse } from 'next/server';
import { generateForgeExample } from '@/lib/server/exampleGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let theme: string | undefined;
  try {
    const body = (await req.json()) as { theme?: unknown };
    if (typeof body.theme === 'string') theme = body.theme;
  } catch {
    /* empty body → random theme */
  }

  try {
    const example = await generateForgeExample(theme);
    return NextResponse.json({ example });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
