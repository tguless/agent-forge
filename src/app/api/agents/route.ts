import { NextResponse } from 'next/server';
import { listAgents } from '@/lib/agentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ agents: listAgents() });
}
