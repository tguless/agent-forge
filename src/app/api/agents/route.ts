import { NextResponse } from 'next/server';
import { groupAgentsByBusiness, listAgents } from '@/lib/agentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const agents = listAgents();
  return NextResponse.json({ agents, groups: groupAgentsByBusiness(agents) });
}
