/**
 * Central site configuration for ariakianzad.ir.
 *
 * Everything here is a supplied fact from the brief. Nothing is invented:
 * no clients, metrics, awards, or testimonials exist anywhere in this project.
 * The only environment override is the canonical origin, so a deployment can
 * be tested on a staging hostname without touching copy.
 */

const env = (key: string, fallback: string) => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : fallback;
};

/** Canonical site origin, with scheme, no trailing slash. */
export const siteUrl = env("NEXT_PUBLIC_SITE_URL", "https://ariakianzad.ir").replace(/\/+$/, "");

export const site = {
  name: "Aria Kianzad",
  /** Public-facing name, always rendered this way. */
  displayName: "Aria Kianzad",
  givenName: "Aria",
  title: "Brand Strategist & Copywriter",
  description:
    "Aria Kianzad is a brand strategist and copywriter focused on brand positioning, clear communication, and the ideas behind meaningful brands.",
  locale: "en",
  ogLocale: "en_US",
  url: siteUrl,
  email: "kianzadaria@gmail.com",
} as const;

/** Rexo: the studio Aria founded in 2024. Related but distinct entity. */
export const rexo = {
  name: "Rexo",
  url: "https://rexo.agency/",
  founded: "2024",
  description:
    "Independent brand strategy and creative studio founded by Aria Kianzad.",
} as const;

/** Social profiles. Exact destinations, verified against the brief. */
export const socials = [
  { id: "youtube", label: "Aria Kianzad on YouTube", href: "https://www.youtube.com/@AriaKianzad" },
  { id: "instagram", label: "Aria Kianzad on Instagram", href: "https://www.instagram.com/ariakianzad" },
  { id: "linkedin", label: "Aria Kianzad on LinkedIn", href: "https://www.linkedin.com/in/ariakianzad" },
  { id: "x", label: "Aria Kianzad on X", href: "https://x.com/ariakianzad" },
  { id: "unsplash", label: "Aria Kianzad on Unsplash", href: "https://unsplash.com/@ariakianzad" },
  { id: "medium", label: "Aria Kianzad on Medium", href: "https://medium.com/@AriaKianzad" },
] as const;

export type SocialId = (typeof socials)[number]["id"];

/**
 * In-page navigation. Anchors only: the site is genuinely single-page, so
 * every destination is a plain `#section` link that works without JavaScript.
 */
export const primaryNav = [
  { label: "Disciplines", href: "/#disciplines" },
  { label: "Approach", href: "/#approach" },
  { label: "Rexo", href: "/#rexo" },
  { label: "About", href: "/#about" },
] as const;

/** Areas of knowledge asserted in structured data, led by the two disciplines. */
export const knowsAbout = [
  "Brand strategy",
  "Copywriting",
  "Brand positioning",
  "Brand communication",
  "Brand differentiation",
  "Strategic copywriting",
  "Verbal identity",
  "Creative direction",
] as const;
