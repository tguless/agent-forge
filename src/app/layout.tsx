import type { Metadata } from 'next';
import { Chakra_Petch, Oxanium } from 'next/font/google';
import '@/styles/globals.css';
import '@/styles/operations-dashboard.css';
import '@/styles/operations-detail.css';
import '@/styles/forge.css';
import { rootMetadata } from '@/lib/metadata';

const oxanium = Oxanium({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-ops-display',
});

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ops-ui',
});

export const metadata: Metadata = rootMetadata;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${oxanium.variable} ${chakraPetch.variable} ops-font-scope`}>
        {children}
      </body>
    </html>
  );
}
