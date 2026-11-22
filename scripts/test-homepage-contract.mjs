import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  page,
  content,
  layout,
  metadata,
  site,
  hero,
  heroEntry,
  heroScene,
  globals,
  chrome,
  sections,
  ui,
  llms,
  packageJson,
  hostHeaders,
  apacheConfig,
  bookPage,
  socialGenerator,
] = await Promise.all([
  read("src/app/page.tsx"),
  read("src/content/home.ts"),
  read("src/app/layout.tsx"),
  read("src/lib/metadata.ts"),
  read("src/lib/site.ts"),
  read("src/components/hero-visual.tsx"),
  read("src/client/hero-visual.ts"),
  read("src/client/signal-scene.ts"),
  read("src/app/globals.css"),
  read("src/app/chrome.css"),
  read("src/app/sections.css"),
  read("public/ui.js"),
  read("public/llms.txt"),
  read("package.json"),
  read("public/_headers"),
  read("public/.htaccess"),
  read("public/Mian-e-Ma/index.html"),
  read("scripts/generate-social-previews.mjs"),
]);

// The homepage remains a semantic, server-rendered page with one primary heading.
assert.equal((page.match(/<h1\b/g) ?? []).length, 1, "homepage must have exactly one h1");
for (const id of ["top", "perspective", "expertise", "method", "rexo", "notes", "about", "contact"]) {
  assert.ok(page.includes(`id="${id}"`), `homepage section #${id} must exist`);
}
for (const heading of [
  "Find the difference.",
  "Make it matter.",
  "Strategy first. Everything else follows.",
  "The most important work happens before the first line.",
]) {
  assert.ok(content.includes(heading), `new homepage copy must include: ${heading}`);
}
assert.ok(page.includes("<HeroVisual />"), "the 3D hero must be mounted in the homepage");
assert.ok(page.includes('data-reveal="up"'), "scroll-reveal hooks must exist in homepage sections");
assert.ok(layout.includes('href="/Mian-e-Ma/"'), "the Persian book remains discoverable from the footer");
assert.ok(metadata.includes('url: "/og/og.jpg"') && metadata.includes('width: 1200') &&
  metadata.includes('height: 630') && metadata.includes('type: "image/jpeg"'),
  "homepage must use its own 1200x630 JPEG social image");
assert.ok(metadata.includes('card: "summary_large_image"'),
  "homepage must expose a large Twitter/X card");
const bookOgImage = bookPage.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? "";
const bookTwitterImage = bookPage.match(/<meta name="twitter:image" content="([^"]+)"/)?.[1] ?? "";
assert.equal(bookOgImage, "https://ariakianzad.github.io/Mian-e-Ma/assets/mian-e-ma-social-preview.jpg?v=20261122-3",
  "book page must use its own dedicated social image");
assert.equal(bookTwitterImage, bookOgImage, "Open Graph and Twitter/X must use the same book preview image");
assert.ok(bookPage.includes('<meta property="og:image:width" content="1200">') &&
  bookPage.includes('<meta property="og:image:height" content="630">') &&
  bookPage.includes('<meta property="og:image:type" content="image/jpeg">'),
  "book social image must declare its 1200x630 JPEG dimensions and MIME type");
assert.ok(bookPage.includes('<meta name="twitter:card" content="summary_large_image">') &&
  bookPage.includes('name="twitter:image:alt"'),
  "book page must expose a complete large-image Twitter/X card");
const bookShareCopy = [
  bookPage.match(/<title>([^<]+)</)?.[1] ?? "",
  bookPage.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? "",
  bookPage.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? "",
  bookPage.match(/<meta property="og:description" content="([^"]+)"/)?.[1] ?? "",
  bookPage.match(/<meta property="og:image:alt" content="([^"]+)"/)?.[1] ?? "",
  bookPage.match(/<meta name="twitter:title" content="([^"]+)"/)?.[1] ?? "",
  bookPage.match(/<meta name="twitter:description" content="([^"]+)"/)?.[1] ?? "",
  bookPage.match(/<meta name="twitter:image:alt" content="([^"]+)"/)?.[1] ?? "",
];
assert.ok(bookShareCopy.every(Boolean), "book title, description and social image alt text must be present");
assert.ok(!bookShareCopy.join(" ").includes("آریا کیانزاد"),
  "author name must not appear in the book page title, descriptions or social preview copy");
assert.ok(packageJson.includes("node scripts/generate-social-previews.mjs"),
  "static build must generate the social preview images before export verification");
assert.ok(socialGenerator.includes('toFile(join(outputRoot, "og/og.jpg"))') &&
  socialGenerator.includes('toFile(join(outputRoot, "Mian-e-Ma/assets/mian-e-ma-social-preview.jpg"))'),
  "social generator must write both page-specific public JPEGs to the static export");
assert.ok(socialGenerator.includes("width = 1200") && socialGenerator.includes("height = 630") &&
  socialGenerator.includes('format !== "jpeg"'),
  "social preview generator must validate the 1200x630 JPEG output format");
assert.ok(!socialGenerator.includes("برای دریافت نسخۀ رایگان کلیک کنید") && socialGenerator.includes('<path d="M82 520H1118"'),
  "book social preview must not include a decorative, non-functional download button");
assert.ok(socialGenerator.includes("mian-e-ma-cover-v2.webp") &&
  socialGenerator.includes("coverMetadata.height * 0.892"),
  "book social preview must be composed from the supplied cover while cropping its author credit");



// Accessibility and consent controls stay out of the normal page flow.
assert.ok(layout.includes('className="skip-link" href="#main"'), "keyboard skip navigation must remain available");
assert.ok(chrome.includes(".skip-link:focus-visible"), "skip navigation must appear when keyboard-focused");
assert.ok(chrome.includes(".analytics-consent {\n  position: fixed;"), "analytics dialog must be viewport-fixed");
assert.ok(chrome.includes(".analytics-preferences {\n  position: fixed;"), "analytics shortcut must be viewport-fixed");
assert.ok(chrome.includes(".analytics-consent[hidden]") && chrome.includes("display: none !important"), "hidden consent controls must respect the hidden attribute");
assert.ok(chrome.includes("@media (max-width: 560px)"), "consent controls need a narrow-screen layout");
assert.ok(globals.includes("overflow-x: clip"), "the document must clip accidental horizontal overflow");
const mobileStyles = sections.split("@media (max-width: 760px)")[1]?.split("@media (max-width: 480px)")[0] ?? "";
const mobileHeroStart = mobileStyles.indexOf(".hero-visual {");
const mobileHeroEnd = mobileStyles.indexOf("}", mobileHeroStart);
const mobileHeroRule = mobileHeroStart >= 0 && mobileHeroEnd > mobileHeroStart
  ? mobileStyles.slice(mobileHeroStart, mobileHeroEnd)
  : "";
assert.ok(mobileHeroRule.includes("margin-block:"), "mobile hero spacing must use vertical margins");
assert.ok(!mobileHeroRule.includes("margin-inline: -"), "mobile hero must not extend horizontally beyond its container");
assert.ok(sections.includes("overflow-wrap: anywhere"), "long contact details must wrap on narrow screens");

// The 3D scene is a standalone, same-origin progressive enhancement.
// The static export deliberately has no React hydration runtime.
assert.ok(!hero.includes('"use client"'), "hero markup must remain a server component");
assert.ok(hero.includes('data-hero-visual'), "static hero root must expose its enhancement hook");
assert.ok(hero.includes('data-signal-canvas'), "static hero must expose the canvas for the renderer");
assert.ok(layout.includes('type="module" src="/_hero/hero-visual.js"'), "standalone hero module must be included in the layout");
assert.ok(heroEntry.includes('import("./signal-scene")'), "Three.js scene must remain a dynamic ESM chunk");
assert.ok(heroEntry.includes("IntersectionObserver"), "scene must load only near the hero viewport");
assert.ok(heroEntry.includes("prefers-reduced-motion: reduce"), "entrypoint must respect reduced-motion preference");
assert.ok(heroEntry.includes("rootMargin: \"220px 0px\""), "scene should load shortly before entering the viewport");
assert.ok(heroEntry.includes('window.addEventListener("pagehide", releaseScenes)'), "scene resources must be released when the page is hidden for navigation");
assert.ok(heroEntry.includes('window.addEventListener("pageshow"'), "the scene must recover after a back-forward cache restore");
assert.ok(hero.includes("hero-visual__fallback"), "hero must provide a CSS visual fallback");
assert.ok(heroScene.includes('from "three"'), "Three.js must be bundled as a local dependency");
assert.ok(heroScene.includes("new THREE.WebGLRenderer"), "hero must render a real WebGL scene");
assert.ok(heroScene.includes("visibilitychange"), "scene animation must pause when the tab is hidden");
assert.ok(heroScene.includes("renderer.dispose()"), "WebGL resources must be disposed during cleanup");
assert.ok(heroEntry.includes("prefers-reduced-motion: reduce"), "entrypoint must enforce reduced-motion preference");
assert.ok(!/https?:\/\//.test(heroScene), "3D scene must not load external resources");
assert.ok(!/eval\s*\(|new Function\s*\(/.test(heroEntry + heroScene), "hero code must not use dynamic code execution");
assert.ok(packageJson.includes("out/_hero") && packageJson.includes("--splitting"), "postbuild must create code-split hero assets");
assert.ok(hostHeaders.includes("/_hero/*") && hostHeaders.includes("max-age=3600, must-revalidate"),
  "stable hero entrypoint must use a revalidation cache");
assert.ok(hostHeaders.includes("/_hero/chunks/*") && hostHeaders.includes("max-age=31536000, immutable"),
  "content-hashed hero chunks should use immutable caching");
assert.ok(apacheConfig.includes('SetEnvIf Request_URI "^/(?:_next/static/|_hero/chunks/)" aria_hashed_asset'),
  "Apache config must identify only content-hashed asset paths");
assert.ok(apacheConfig.includes('Header always set Cache-Control "public, max-age=3600, must-revalidate"'),
  "fixed-name scripts, CSS and fonts must revalidate");
assert.ok(apacheConfig.includes('env=aria_hashed_asset'),
  "Apache immutable cache rule must be restricted to hashed assets");


// Animation must degrade gracefully and remain responsive.
assert.ok(globals.includes("@media (prefers-reduced-motion: reduce)"), "global reduced-motion fallback missing");
assert.ok(sections.includes("@media (max-width: 760px)"), "tablet/mobile responsive breakpoint missing");
assert.ok(sections.includes("@media (max-width: 480px)"), "small phone responsive breakpoint missing");
assert.ok(chrome.includes("html:not([data-js]) .site-nav__list"), "navigation needs a no-JavaScript fallback");
const mobileNavigation = chrome.split("@media (max-width: 780px)")[1]?.split("@media (max-width: 480px)")[0] ?? "";
assert.ok(mobileNavigation.includes("position: absolute;") && mobileNavigation.includes("top: 100%;"),
  "mobile menu must open beneath the sticky header rather than inside its backdrop-filter containing block");
assert.ok(mobileNavigation.includes("height: calc(100dvh - var(--header-h));") && mobileNavigation.includes("overflow-y: auto;"),
  "mobile menu must use the available dynamic viewport height and remain scrollable");
assert.ok(mobileNavigation.includes(".header-cta {") && mobileNavigation.includes("flex: 0 0 auto;"),
  "the Let's talk action must keep its layout space on mobile");
const narrowHeader = chrome.split("@media (max-width: 480px)")[1]?.split("@media (max-width: 360px)")[0] ?? "";
assert.ok(narrowHeader.includes(".wordmark__copy small {\n    display: none;"),
  "small screens must compact the brand lockup to preserve the CTA");
assert.ok(ui.includes("first.focus({ preventScroll: true })"),
  "opening the mobile menu must not scroll the page behind its overlay");
assert.ok(sections.includes(".expertise-card__graphic {\n  position: relative;\n  display: grid;\n  height: 190px;") &&
  sections.includes("margin-block: 0.7rem 1.3rem;\n  overflow: visible;"),
  "expertise card diagrams must have enough visible space for hover transforms");
assert.ok(sections.includes("scale(1.16)") && sections.includes("scale(1.14)") &&
  sections.includes(".expertise-card:hover .expertise-card__graphic-dot"),
  "small expertise graphics should have more expressive hover motion");
assert.ok(globals.includes("opacity 900ms var(--ease-out)") &&
  globals.includes("translate3d(0, 38px, 0)"),
  "in-section reveal motion should be more pronounced without changing the hero renderer");
assert.ok(ui.includes('querySelectorAll("[data-reveal]")'), "existing progressive reveal controller should remain active");

// Metadata and AI-readable site information must match the new positioning.
for (const schemaType of ["WebSite", "ProfilePage", "Person", "Organization"]) {
  assert.ok(layout.includes(`"@type": "${schemaType}"`), `JSON-LD ${schemaType} missing`);
}
assert.ok(metadata.includes("Brand Strategy & Personal Branding"), "SEO page title must reflect the new positioning");
assert.ok(metadata.includes("brand positioning"), "SEO description/keywords must mention positioning");
assert.ok(site.includes("Personal Branding Consultant"), "Person job title must match public positioning");
assert.ok(llms.includes("Personal branding"), "llms.txt must describe personal branding");
assert.ok(llms.includes("research and insight"), "llms.txt must describe research-led strategy");
assert.ok(llms.includes("RexoMag"), "llms.txt must expose the editorial platform");
assert.ok(llms.includes("creative agency"), "llms.txt must describe Rexo as an agency");

// Security invariants: no new external runtime origin, unsafe inline JS or eval.
assert.ok(layout.includes("Content-Security-Policy"), "CSP meta policy must remain in the root layout");
assert.ok(!/unsafe-inline|unsafe-eval/.test(layout), "CSP must not allow unsafe inline code or eval");
assert.ok(!/eval\s*\(|new Function\s*\(/.test(heroScene), "3D scene must not use dynamic code execution");

console.log("Homepage redesign contract passed: semantic SEO, AI-readable copy, 3D hero, responsive and reduced-motion fallbacks, CSP, and no-JavaScript navigation.");
