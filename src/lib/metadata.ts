import type { Metadata } from "next";
import { site } from "./site";

export const socialImage = {
  url: "/og/og.jpg?v=20261128-1",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Aria Kianzad. Brand strategy and personal branding. Find the difference. Make it matter.",
} as const;

const pageTitle = "Aria Kianzad | Brand Strategy & Personal Branding";
const pageDescription =
  "Brand strategist Aria Kianzad works across positioning, research, identity and communication, helping brands turn insight into clear, distinctive meaning.";

export function rootMetadata(): Metadata {
  return {
    metadataBase: new URL(site.url),
    icons: {
      icon: [
        { url: "/favicon.svg?v=20261128-1", type: "image/svg+xml" },
        { url: "/icon.png?v=20261128-1", type: "image/png", sizes: "512x512" },
      ],
      shortcut: ["/favicon.svg?v=20261128-1"],
      apple: [{ url: "/apple-icon.png?v=20261128-1", type: "image/png", sizes: "180x180" }],
    },
    title: pageTitle,
    description: pageDescription,
    applicationName: site.name,
    authors: [{ name: site.name, url: site.url }],
    creator: site.name,
    publisher: site.name,
    keywords: [
      "Aria Kianzad",
      "brand strategist",
      "brand strategy",
      "brand positioning",
      "personal branding",
      "brand identity",
      "content strategy",
      "brand communication",
      "brand storytelling",
    ],
    verification: {
      google: "UhIDVQ1toOjgUhS7bONWQB-lmnoRW5gbZkI1ZRpjpo8",
    },
    formatDetection: { telephone: false, address: false, email: false },
    alternates: { canonical: "/" },
    openGraph: {
      type: "profile",
      siteName: site.name,
      locale: site.ogLocale,
      url: "/",
      title: pageTitle,
      description: pageDescription,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
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
