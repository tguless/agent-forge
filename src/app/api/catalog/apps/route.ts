import { NextResponse } from 'next/server';
import { listApps, listAppTypes } from '@/lib/catalogStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const appType = new URL(req.url).searchParams.get('type') ?? undefined;
  return NextResponse.json({
    appTypes: listAppTypes(),
    apps: listApps(appType ?? undefined),
  });
}
