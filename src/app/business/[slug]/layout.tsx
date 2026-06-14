import type { Metadata } from 'next';
import { getBusiness } from '@/lib/businessStore';
import { buildBusinessMetadata, buildSocialMetadata } from '@/lib/metadata';

export const runtime = 'nodejs';

type Props = {
  params: { slug: string };
  children: React.ReactNode;
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const business = getBusiness(params.slug);
  if (!business) {
    return {
      title: 'Business not found',
      ...buildSocialMetadata({ title: 'Business not found · Agent Forge' }),
    };
  }
  return buildBusinessMetadata(business);
}

export default function BusinessBlueprintLayout({ children }: Props) {
  return children;
}
