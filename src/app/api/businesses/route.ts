import { NextResponse } from 'next/server';
import { createBusiness, listBusinesses } from '@/lib/businessStore';
import { startBusinessConsult, ensurePlaceholderBusinessAndConsult } from '@/lib/server/businessRunner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Lazy bootstrap: ensure the placeholder business exists + adopt orphan agents.
  ensurePlaceholderBusinessAndConsult();
  return NextResponse.json({ businesses: listBusinesses() });
}

export async function POST(req: Request) {
  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const description = (body.description ?? '').trim();
  const name = (body.name ?? '').trim();
  if (!description) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }

  const slug = createBusiness({ name: name || description.slice(0, 48), description });
  startBusinessConsult(slug);
  return NextResponse.json({ slug });
}
