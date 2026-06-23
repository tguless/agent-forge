import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_FILES = new Set(['plaque.png', 'og-image.png']);

/** Serve runtime-generated business plaque PNGs (standalone only indexes public/ at boot). */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await ctx.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !ALLOWED_FILES.has(file)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const abs = path.join(process.cwd(), 'data', 'businesses', slug, file);
  if (!fs.existsSync(abs)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const buf = fs.readFileSync(abs);
  const stat = fs.statSync(abs);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'ETag': `"${stat.mtimeMs}"`,
    },
  });
}
