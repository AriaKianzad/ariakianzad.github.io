/**
 * Shared document metadata for the root layout and future routes.
 *
 * Next.js replaces a nested `openGraph` object rather than deep-merging it, so
 * every social property is stated in one complete object rather than relying
 * on inheritance.
 */

import type { Metadata } from "next";
import { site } from "./site";

/**
 * The social card image, generated at build time from assets-src/ by
 * scripts/generate-assets.mjs. Dimensions must match the PNG exactly; they
 * are declared so crawlers can reserve space before the file loads.
 */
export const socialImage = {
  url: "/og/og.png",
  width: 1200,
  height: 630,
  alt: "Aria Kianzad, brand strategist and copywriter.",
} as const;

export function rootMetadata(): Metadata {
  return {
    metadataBase: new URL(site.url),
    title: "Aria Kianzad | Brand Strategist & Copywriter",
    description: site.description,
    applicationName: site.name,
    authors: [{ name: site.name, url: site.url }],
    creator: site.name,
    publisher: site.name,
    formatDetection: { telephone: false, address: false, email: false },
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: site.ogLocale,
      url: "/",
      title: "Aria Kianzad | Brand Strategist & Copywriter",
      description: site.description,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: "Aria Kianzad | Brand Strategist & Copywriter",
      description: site.description,
      images: [socialImage.url],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}
