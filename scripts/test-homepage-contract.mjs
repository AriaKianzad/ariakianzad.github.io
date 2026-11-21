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
