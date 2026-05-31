import type { Metadata } from 'next';
import { Chakra_Petch, Oxanium } from 'next/font/google';
import '@/styles/globals.css';
import '@/styles/operations-dashboard.css';
import '@/styles/operations-detail.css';
import '@/styles/forge.css';

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

export const metadata: Metadata = {
  title: 'Agent Forge — Tactical Agent Card Generator',
  description:
    'Turn a minimal job description and business context into a fully realized tactical command-card agent with a generated skill file and visual identity.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${oxanium.variable} ${chakraPetch.variable} ops-font-scope`}>
        {children}
      </body>
    </html>
  );
}
