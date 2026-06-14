import { NextResponse } from 'next/server';
import { getBusiness, selectBusinessApp, listBusinessApps } from '@/lib/businessStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** User override: select a specific app for its type. */
export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const business = getBusiness(params.slug);
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let body: { appId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const appId = Number(body.appId);
  if (!Number.isFinite(appId)) {
    return NextResponse.json({ error: 'appId is required' }, { status: 400 });
  }

  const ok = selectBusinessApp(params.slug, appId);
  if (!ok) {
    return NextResponse.json({ error: 'app is not in this business stack' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, apps: listBusinessApps(params.slug) });
}
