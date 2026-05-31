import { getAgent } from '@/lib/agentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const agent = getAgent(params.slug);
  if (!agent) return new Response('not found', { status: 404 });
  return new Response(agent.skillMarkdown || '# Skill module pending…', {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}
