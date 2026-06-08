import type { Metadata } from 'next';
import { getAgent } from '@/lib/agentStore';
import { buildAgentMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

type LayoutProps = {
  children: React.ReactNode;
  params: { slug: string };
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const record = getAgent(params.slug);
  if (!record) {
    return { title: 'Agent not found' };
  }
  return buildAgentMetadata(record.data);
}

export default function AgentDetailLayout({ children }: LayoutProps) {
  return children;
}
