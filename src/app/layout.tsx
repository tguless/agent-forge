import type { Metadata, Viewport } from 'next';
import { Chakra_Petch, Oxanium } from 'next/font/google';
import '@/styles/globals.css';
import '@/styles/operations-dashboard.css';
import '@/styles/operations-detail.css';
import '@/styles/forge.css';
import { rootMetadata } from '@/lib/metadata';
import { ForgeSoundProvider } from '@/components/ForgeSoundProvider';
import { ForgeUiSettingsProvider } from '@/components/ForgeUiSettingsProvider';
import { ForgeAmbientMusicController } from '@/components/ForgeAmbientMusicController';

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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${oxanium.variable} ${chakraPetch.variable} ops-font-scope`}>
        <ForgeUiSettingsProvider>
          <ForgeAmbientMusicController />
          <ForgeSoundProvider>{children}</ForgeSoundProvider>
        </ForgeUiSettingsProvider>
      </body>
    </html>
  );
}
