import type { Metadata } from 'next';
import { buildNewBusinessMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildNewBusinessMetadata();

export default function NewBusinessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
