import type { Metadata } from 'next';
import { absoluteUrl, getSiteUrl } from '@/lib/site-url';
import type { Business } from '@/lib/businessTypes';

const SITE_NAME = 'Agent Forge';
const DEFAULT_TITLE = 'Agent Forge — Tactical AI agent card generator';
const DEFAULT_DESCRIPTION =
  'Turn a job description and business context into a tactical command-card agent with skill file, emblem, portrait, and icon.';

const OG_IMAGE_PATH = '/og-image.png';
const OG_IMAGE_ALT = 'Agent Forge — tactical AI agent card generator on PaperIQ';

/** Shared Open Graph + Twitter card fields for social link previews. */
export function buildSocialMetadata(overrides?: {
  title?: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
}): Pick<Metadata, 'openGraph' | 'twitter'> {
  const title = overrides?.title ?? DEFAULT_TITLE;
  const description = overrides?.description ?? DEFAULT_DESCRIPTION;
  const pageUrl = overrides?.url ?? getSiteUrl();
  const imageUrl = overrides?.imageUrl ?? absoluteUrl(OG_IMAGE_PATH);
  const imageAlt = overrides?.imageAlt ?? OG_IMAGE_ALT;
  const imageWidth = overrides?.imageWidth ?? 1200;
  const imageHeight = overrides?.imageHeight ?? 630;

  return {
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: pageUrl,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: imageWidth,
          height: imageHeight,
          alt: imageAlt,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

/** Per-agent command profile — portrait (or emblem/icon) for link previews. */
export function buildAgentMetadata(agent: {
  slug: string;
  title: string;
  subtitle?: string;
  callsign?: string;
  role?: string;
  q1Objective?: string;
  mission?: string;
  portraitPath?: string;
  emblemPath?: string;
  iconPath?: string;
}): Metadata {
  const headline = agent.callsign ? `${agent.title} (${agent.callsign})` : agent.title;
  const title = `${headline} · ${SITE_NAME}`;
  const description =
    agent.q1Objective?.trim() ||
    agent.mission?.trim() ||
    agent.subtitle?.trim() ||
    agent.role?.trim() ||
    DEFAULT_DESCRIPTION;
  const imagePath = agent.portraitPath || agent.emblemPath || agent.iconPath || OG_IMAGE_PATH;
  const pageUrl = absoluteUrl(`/agent/${agent.slug}`);
  const imageAlt = `${agent.title} — tactical command profile`;
  const isPortrait = !!agent.portraitPath;

  return {
    title: headline,
    description,
    alternates: { canonical: pageUrl },
    ...buildSocialMetadata({
      title,
      description,
      url: pageUrl,
      imageUrl: absoluteUrl(imagePath),
      imageAlt,
      imageWidth: isPortrait ? 480 : 512,
      imageHeight: isPortrait ? 600 : 512,
    }),
  };
}

/** Per-business blueprint — sector plaque for link previews (matches header mount). */
export function buildBusinessMetadata(business: Business): Metadata {
  const title = `${business.name} · ${SITE_NAME}`;
  const description =
    business.profile.summary?.trim() ||
    business.profile.elevatorPitch?.trim() ||
    business.description.trim() ||
    DEFAULT_DESCRIPTION;
  const pageUrl = absoluteUrl(`/business/${business.slug}`);
  const imagePath = business.profile.plaquePath || OG_IMAGE_PATH;
  const imageAlt = `${business.name} — business identity plaque`;
  const hasPlaque = !!business.profile.plaquePath;

  return {
    title: business.name,
    description,
    alternates: { canonical: pageUrl },
    ...buildSocialMetadata({
      title,
      description,
      url: pageUrl,
      imageUrl: absoluteUrl(imagePath),
      imageAlt,
      imageWidth: hasPlaque ? 512 : 1200,
      imageHeight: hasPlaque ? 512 : 630,
    }),
  };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  ...buildSocialMetadata(),
};
