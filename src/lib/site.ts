/**
 * Central site configuration for the GitHub Pages website.
 * Public facts only. No clients, metrics, awards or testimonials are implied.
 */

const env = (key: string, fallback: string) => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : fallback;
};

const normalizeSiteOrigin = (raw: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid absolute URL.");
  }
  const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalHost)) {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS (HTTP is allowed only for localhost).");
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must contain only an origin, without credentials, path, query or fragment.");
  }
  return parsed.origin;
};

export const siteUrl = normalizeSiteOrigin(env("NEXT_PUBLIC_SITE_URL", "https://ariakianzad.github.io"));

export const site = {
  name: "Aria Kianzad",
  displayName: "Aria Kianzad",
  givenName: "Aria",
  title: "Brand Strategist & Personal Branding Consultant",
  description:
    "Aria Kianzad is a brand strategist and personal branding consultant working across positioning, research, identity and communication.",
  locale: "en",
  ogLocale: "en_US",
  url: siteUrl,
  email: "kianzadaria@gmail.com",
} as const;

/** Rexo is the independent creative studio Aria founded in 2024. */
export const rexo = {
  name: "Rexo",
  url: "https://rexo.agency/",
  founded: "2024",
  description:
    "Independent creative studio founded by Aria Kianzad, bringing brand strategy and creative execution together.",
} as const;

export const socials = [
  { id: "youtube", label: "Aria Kianzad on YouTube", href: "https://www.youtube.com/@AriaKianzad" },
  { id: "instagram", label: "Aria Kianzad on Instagram", href: "https://www.instagram.com/ariakianzad" },
  { id: "linkedin", label: "Aria Kianzad on LinkedIn", href: "https://www.linkedin.com/in/ariakianzad" },
  { id: "x", label: "Aria Kianzad on X", href: "https://x.com/ariakianzad" },
  { id: "unsplash", label: "Aria Kianzad on Unsplash", href: "https://unsplash.com/@ariakianzad" },
  { id: "medium", label: "Aria Kianzad on Medium", href: "https://medium.com/@AriaKianzad" },
] as const;

export type SocialId = (typeof socials)[number]["id"];

export const primaryNav = [
  { label: "Expertise", href: "/#expertise" },
  { label: "Method", href: "/#method" },
  { label: "Rexo", href: "/#rexo" },
  { label: "Writing", href: "/#notes" },
  { label: "About", href: "/#about" },
] as const;

export const knowsAbout = [
  "Brand strategy",
  "Personal branding",
  "Brand positioning",
  "Market research",
  "Consumer insight",
  "Brand identity development",
  "Brand differentiation",
  "Brand communication",
  "Content strategy",
  "SEO content strategy",
  "Brand storytelling",
  "Copywriting",
  "Creative direction",
] as const;
