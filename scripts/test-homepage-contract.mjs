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
  heroScene,
  globals,
  chrome,
  sections,
  ui,
  llms,
] = await Promise.all([
  read("src/app/page.tsx"),
  read("src/content/home.ts"),
  read("src/app/layout.tsx"),
  read("src/lib/metadata.ts"),
  read("src/lib/site.ts"),
  read("src/components/hero-visual.tsx"),
  read("src/components/signal-scene.tsx"),
  read("src/app/globals.css"),
  read("src/app/chrome.css"),
  read("src/app/sections.css"),
  read("public/ui.js"),
  read("public/llms.txt"),
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

// The 3D scene is local, lazy-loaded, progressive and respects accessibility preferences.
assert.ok(hero.includes('dynamic(() => import("./signal-scene")'), "Three.js scene must be dynamically imported");
assert.ok(hero.includes("ssr: false"), "WebGL scene must stay client-only for static export");
assert.ok(hero.includes("IntersectionObserver"), "scene must load only near the hero viewport");
assert.ok(hero.includes("prefers-reduced-motion: reduce"), "hero must read reduced-motion preference");
assert.ok(hero.includes("hero-visual__fallback"), "hero must provide a CSS visual fallback");
assert.ok(hero.includes("className={`hero-visual"), "hero visual must be present without WebGL");
assert.ok(heroScene.includes('from "three"'), "Three.js must be bundled as a local dependency");
assert.ok(heroScene.includes("new THREE.WebGLRenderer"), "hero must render a real WebGL scene");
assert.ok(heroScene.includes("visibilitychange"), "scene animation must pause when the tab is hidden");
assert.ok(heroScene.includes("renderer.dispose()"), "WebGL resources must be disposed on unmount");
assert.ok(heroScene.includes("prefers-reduced-motion: reduce"), "scene itself must support reduced motion");
assert.ok(!/https?:\/\//.test(heroScene), "3D scene must not load external resources");

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

// Security invariants: no new external runtime origin, unsafe inline JS or eval.
assert.ok(layout.includes("Content-Security-Policy"), "CSP meta policy must remain in the root layout");
assert.ok(!/unsafe-inline|unsafe-eval/.test(layout), "CSP must not allow unsafe inline code or eval");
assert.ok(!/eval\s*\(|new Function\s*\(/.test(heroScene), "3D scene must not use dynamic code execution");

console.log("Homepage redesign contract passed: semantic SEO, AI-readable copy, 3D hero, responsive and reduced-motion fallbacks, CSP, and no-JavaScript navigation.");
