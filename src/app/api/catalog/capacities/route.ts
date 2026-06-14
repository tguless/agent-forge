import { NextResponse } from 'next/server';
import { listCapacities } from '@/lib/catalogStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ capacities: listCapacities() });
}
