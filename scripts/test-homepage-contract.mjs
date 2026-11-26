import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const estedadProbe = new Resvg(
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="110">
    <text x="400" y="78" text-anchor="end" direction="rtl" font-family="Estedad" font-size="64" fill="#000">میانِ ما</text>
  </svg>`,
  {
    font: {
      fontFiles: [
        fileURLToPath(new URL("../assets-src/Estedad-Regular.ttf", import.meta.url)),
        fileURLToPath(new URL("../assets-src/Estedad-SemiBold.ttf", import.meta.url)),
      ],
      loadSystemFonts: false,
    },
  },
).render();
const estedadProbePixels = estedadProbe.pixels;
let estedadInkPixels = 0;
for (let i = 3; i < estedadProbePixels.length; i += 4) {
  if (estedadProbePixels[i] > 0) estedadInkPixels++;
}
assert.ok(estedadInkPixels > 100, "bundled Estedad font files must render Persian glyphs without system-font fallback");
const rtlAnchorProbe = new Resvg(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="110">
    <text x="770" y="78" text-anchor="end" direction="rtl" font-family="Estedad" font-size="26" fill="#000">برای فهم بهترِ گفت‌وگو، تعهد و آنچه</text>
  </svg>`,
  {
    font: {
      fontFiles: [
        fileURLToPath(new URL("../assets-src/Estedad-Regular.ttf", import.meta.url)),
        fileURLToPath(new URL("../assets-src/Estedad-SemiBold.ttf", import.meta.url)),
      ],
      loadSystemFonts: false,
    },
  },
);
const rtlAnchorBounds = rtlAnchorProbe.getBBox();
assert.ok(rtlAnchorBounds, "RTL social-preview text must have measurable glyph bounds");
assert.ok(rtlAnchorBounds.x + rtlAnchorBounds.width <= 772,
  "right-aligned RTL social-preview text must end before the book-cover column");
assert.ok(rtlAnchorBounds.x < 770,
  "right-aligned RTL social-preview text must extend left from its anchor, not into the cover");


const [
  page,
  content,
  layout,
  siteChrome,
  metadata,
  site,
  hero,
  heroEntry,
  heroScene,
  homeScenes,
  globals,
  chrome,
  sections,
  ui,
  llms,
  packageJson,
  hostHeaders,
  apacheConfig,
  bookPage,
  bookStyles,
  socialGenerator,
  notFoundContent,
  blogLayout,
  blogArticle,
  blogContact,
  blogPage,
  faviconSource,
  adminDashboard,
  adminBlogDashboard,
  assetGenerator,
  exportVerifier,
] = await Promise.all([
  read("src/app/page.tsx"),
  read("src/content/home.ts"),
  read("src/app/layout.tsx"),
  read("src/components/SiteChrome.tsx"),
  read("src/lib/metadata.ts"),
  read("src/lib/site.ts"),
  read("src/components/hero-visual.tsx"),
  read("src/client/hero-visual.ts"),
  read("src/client/signal-scene.ts"),
  read("src/client/home-scenes.ts"),
  read("src/app/globals.css"),
  read("src/app/chrome.css"),
  read("src/app/sections.css"),
  read("public/ui.js"),
  read("public/llms.txt"),
  read("package.json"),
  read("public/_headers"),
  read("public/.htaccess"),
  read("public/Mian-e-Ma/index.html"),
  read("public/Mian-e-Ma/styles.css"),
  read("scripts/generate-social-previews.mjs"),
  read("src/app/NotFoundContent.tsx"),
  read("src/app/blog/layout.tsx"),
  read("src/app/blog/[slug]/page.tsx"),
  read("src/app/blog/contact/page.tsx"),
  read("src/app/blog/page.tsx"),
  read("public/favicon.svg"),
  read("public/admin/index.html"),
  read("public/admin/blog/index.html"),
  read("scripts/generate-assets.mjs"),
  read("scripts/verify-export.mjs"),
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
assert.ok(siteChrome.includes('href="/Mian-e-Ma/"'), "the Persian book remains discoverable from the portfolio footer");
assert.ok(metadata.includes('url: "/og/og.jpg"') && metadata.includes('width: 1200') &&
  metadata.includes('height: 630') && metadata.includes('type: "image/jpeg"'),
  "homepage must use its own 1200x630 JPEG social image");
assert.ok(metadata.includes('card: "summary_large_image"'),
  "homepage must expose a large Twitter/X card");
const bookOgImage = bookPage.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? "";
const bookTwitterImage = bookPage.match(/<meta name="twitter:image" content="([^"]+)"/)?.[1] ?? "";
assert.equal(bookOgImage, "https://ariakianzad.github.io/Mian-e-Ma/assets/mian-e-ma-social-preview.jpg?v=20261126-1",
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
const bookHeader = bookPage.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1] ?? "";
assert.ok(bookHeader.includes('class="brand"') && bookHeader.includes('class="main-nav"'),
  "book header must retain the brand and primary navigation");
assert.ok(!bookHeader.includes("header-download"),
  "the book header must not contain a redundant download CTA");
assert.equal((bookPage.match(/class="button-primary"/g) ?? []).length, 2,
  "the hero and download sections must retain their two primary download CTAs");
const bookDownloadLinks = [...bookPage.matchAll(/<a\b[^>]*class="button-primary"[^>]*>/g)].map(([tag]) => tag);
const bookDownloadUrl = "https://github.com/AriaKianzad/ariakianzad.github.io/releases/download/mian-e-ma-v1/Mian-e-Ma.pdf";
assert.ok(bookDownloadLinks.some((tag) => tag.includes('id="book-download-hero"')),
  "the hero download CTA must expose a stable GA4 link_id");
assert.ok(bookDownloadLinks.some((tag) => tag.includes('id="book-download-section"')),
  "the download-section CTA must expose a distinct stable GA4 link_id");
assert.ok(bookDownloadLinks.every((tag) => tag.includes(`href="${bookDownloadUrl}"`)),
  "both download CTAs must continue pointing to the same published PDF");
assert.ok(!bookStyles.includes("header-download"),
  "removed header CTA must not leave orphaned CSS rules");
assert.ok(bookStyles.includes("grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)") &&
  bookStyles.includes(".brand{grid-column:1;justify-self:start") &&
  bookStyles.includes(".main-nav{grid-column:2;justify-self:center"),
  "desktop header must balance the brand and center the navigation without a third visible item");
assert.ok(bookStyles.includes("@media(max-width:900px){.header-inner{display:flex;flex-wrap:wrap") &&
  bookStyles.includes(".brand{width:100%;justify-content:flex-start}.main-nav{width:100%;justify-content:center;flex-wrap:wrap"),
  "tablet header must place the navigation on its own centered, wrapping row");
assert.ok(bookStyles.includes("@media(max-width:680px){") &&
  bookStyles.includes(".header-inner{min-height:70px;display:flex;flex-wrap:nowrap") &&
  bookStyles.includes(".main-nav{display:none}"),
  "mobile header must keep a compact single-row brand and hide the desktop navigation");
assert.ok(packageJson.includes("node scripts/generate-social-previews.mjs"),
  "static build must generate the social preview images before export verification");
assert.ok(socialGenerator.includes('toFile(join(outputRoot, "og/og.jpg"))') &&
  socialGenerator.includes('toFile(join(outputRoot, "Mian-e-Ma/assets/mian-e-ma-social-preview.jpg"))'),
  "social generator must write both page-specific public JPEGs to the static export");
assert.ok(socialGenerator.includes("width = 1200") && socialGenerator.includes("height = 630") &&
  socialGenerator.includes('format !== "jpeg"'),
  "social preview generator must validate the 1200x630 JPEG output format");
assert.ok(socialGenerator.includes('import { Resvg } from "@resvg/resvg-js"') &&
  socialGenerator.includes("fontFiles: estedadFontFiles") &&
  socialGenerator.includes("loadSystemFonts: true") &&
  socialGenerator.includes("new Resvg(svg, {"),
  "social previews must register Estedad font files with a renderer that supports explicit font loading");
assert.ok(socialGenerator.includes('join(root, "assets-src/Estedad-Regular.ttf")') &&
  socialGenerator.includes('join(root, "assets-src/Estedad-SemiBold.ttf")') &&
  !socialGenerator.includes("data:font/ttf;base64"),
  "social previews must load the bundled Estedad faces directly instead of relying on unsupported embedded @font-face data");
const homepageSvgSource = socialGenerator.split("const homepageSvg = `")[1]?.split("</svg>`")[0] ?? "";
assert.ok(homepageSvgSource.includes('stop-color="#f3f0e8"') &&
  homepageSvgSource.includes('fill="#d6a443"') &&
  homepageSvgSource.includes('fill="#7b3f58"'),
  "homepage social preview must use the new paper, plum and brass palette");
assert.ok(!/(#080d0b|#0b110e|#070b09|#c6e887|#879d63|#bdcba9)/i.test(homepageSvgSource),
  "homepage social preview must not retain the previous dark-lime palette");



assert.ok(!faviconSource.includes('fill="#f3f0e8"') &&
  faviconSource.includes('<rect x="16" y="16" width="480" height="480" rx="132" fill="#7b3f58"/>') &&
  faviconSource.includes('stroke="#fbf9f4"') &&
  faviconSource.includes('fill="#d6a443"') &&
  faviconSource.includes('<path d="M108 356 181 155'),
  "the shared favicon must have a transparent outer canvas, a full-bleed plum tile and a centered cream AK monogram with a brass dot");
assert.ok(assetGenerator.includes('writeFileSync(join(ROOT, "public", "favicon.svg")') &&
  !assetGenerator.includes('public", "og", "og.png'),
  "favicon source must be generated centrally and the legacy PNG social card must not return");
assert.ok(metadata.includes('url: "/og/og.jpg"') &&
  !layout.includes('/og/og.png'),
  "JSON-LD and social metadata must reference the same current JPEG preview");
for (const html of [adminDashboard, adminBlogDashboard, bookPage]) {
  assert.ok(html.includes('href="/favicon.svg"') &&
    html.includes('href="/icon.png"') &&
    html.includes('href="/apple-icon.png"'),
    "the shared favicon set must be used in every standalone page");
}
assert.ok(metadata.includes('url: "/favicon.svg"') &&
  blogLayout.includes('url: "/favicon.svg"'),
  "Next.js metadata must use the shared vector favicon on the homepage and blog");
assert.ok(!blogLayout.includes("blog-favicon.svg") &&
  !layout.includes("blog-favicon.svg"),
  "the old blog-only favicon must no longer be referenced");

assert.ok(blogLayout.includes("<style>{themeStyles}</style>") &&
  blogArticle.includes("<style>{articleStyles}</style>") &&
  !blogLayout.includes("style={") &&
  !blogArticle.includes("style={"),
  "dynamic blog styles must be emitted as CSP-hashed style blocks, not style attributes");
assert.ok(exportVerifier.includes("inline style attributes are blocked by the strict CSP") &&
  exportVerifier.includes('href="/favicon.svg"'),
  "export verification must reject inline styles and missing shared favicons");

assert.ok(!layout.includes('/blog-contact.js') &&
  !layout.includes('/blog-copy.js') &&
  !layout.includes('/blog-listing.js') &&
  !layout.includes('/_hero/hero-visual.js'),
  "route-specific scripts must not be loaded from the global layout");
assert.ok(blogLayout.includes('/blog-listing.js') &&
  blogArticle.includes('/blog-copy.js') &&
  blogContact.includes('/blog-contact.js') &&
  blogPage.includes('/_hero/hero-visual.js') &&
  page.includes('/_hero/hero-visual.js'),
  "blog, contact and hero scripts must be loaded on the routes that use them");


const bookSvgSource = socialGenerator.split("const bookSvg = `")[1]?.split("</svg>`;")[0] ?? "";
const bookPreviewColors = ["#f3f0e8", "#7b3f58", "#d6a443", "#4a2637"];
assert.ok(bookPreviewColors.every((color) => bookSvgSource.includes(color)),
  "book social preview must use the current paper, plum, brass and ink palette");
assert.ok(!/(#36534f|#244241|#78958f)/i.test(bookSvgSource),
  "book social preview must not retain the previous teal palette");
assert.equal(
  [...bookSvgSource.matchAll(/<text class="fa"[^>]*text-anchor="end" direction="rtl"/g)].length,
  6,
  "all six Persian book-preview text lines must be anchored away from the cover column",
);
assert.ok(!bookSvgSource.includes('text-anchor="start" direction="rtl"'),
  "book-preview RTL text must not use a start anchor that sends the text under the cover");
assert.ok(!socialGenerator.includes("برای دریافت نسخۀ رایگان کلیک کنید") && socialGenerator.includes('<path d="M82 520H1118"'),
  "book social preview must not include a decorative, non-functional download button");
assert.ok(socialGenerator.includes("mian-e-ma-cover-v2.webp") &&
  socialGenerator.includes("coverMetadata.height * 0.892"),
  "book social preview must be composed from the supplied cover while cropping its author credit");



// Accessibility and consent controls stay out of the normal page flow.
assert.ok(siteChrome.includes('className="skip-link" href="#main"'), "keyboard skip navigation must remain available on portfolio routes");
assert.ok(siteChrome.includes('<main id="main" tabIndex={-1}>'), "the portfolio skip-link target must accept keyboard focus");
assert.ok(bookPage.includes('class="skip-link" href="#main"') && bookPage.includes('<main id="main" tabindex="-1">'), "the book skip link must target a focusable main landmark");
assert.ok(chrome.includes(".skip-link:focus-visible"), "skip navigation must appear when keyboard-focused");
assert.ok(notFoundContent.includes('<div className="not-found-page not-found-main"') && !notFoundContent.includes('<main className="not-found-page not-found-main"'), "root 404 content must not nest a main landmark inside SiteChrome's main");
assert.ok(layout.includes('role="region"') && layout.includes('aria-labelledby="analytics-consent-title"') && !layout.includes('role="dialog"'), "portfolio privacy preferences must use non-modal labelled-region semantics");
assert.ok(bookPage.includes('role="region"') && bookPage.includes('aria-labelledby="analytics-consent-title"') && !bookPage.includes('role="dialog"'), "book privacy preferences must use non-modal labelled-region semantics");
assert.ok(chrome.includes(".analytics-consent {\n  position: fixed;"), "analytics consent panel must be viewport-fixed");
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
assert.ok(page.includes('type="module" src="/_hero/hero-visual.js"') &&
  blogPage.includes('type="module" src="/_hero/hero-visual.js"') &&
  !layout.includes('type="module" src="/_hero/hero-visual.js"'),
  "standalone hero module must be loaded only on the homepage and blog archive routes that render it");
assert.ok(heroEntry.includes('import("./signal-scene")'), "Three.js scene must remain a dynamic ESM chunk");
assert.ok(heroEntry.includes("IntersectionObserver"), "scene must load only near the hero viewport");
assert.ok(heroEntry.includes("prefers-reduced-motion: reduce"), "entrypoint must respect reduced-motion preference");
assert.ok(heroEntry.includes("rootMargin: \"220px 0px\""), "scene should load shortly before entering the viewport");
assert.ok(heroEntry.includes('window.addEventListener("pagehide", releaseScenes)'), "scene resources must be released when the page is hidden for navigation");
assert.ok(heroEntry.includes('window.addEventListener("pageshow"'), "the scene must recover after a back-forward cache restore");
assert.ok(hero.includes("hero-visual__fallback"), "hero must provide a CSS visual fallback");
assert.ok(heroScene.includes('from "three"'), "Three.js must be bundled as a local dependency");
assert.ok(heroScene.includes("new THREE.WebGLRenderer"), "hero must render a real WebGL scene");
assert.ok(homeScenes.includes('size: compact ? 0.024 : 0.022') &&
  homeScenes.includes('size: compact ? 0.014 : 0.013'),
  "homepage wave points and particles must stay within small world-space sizes");
const pointMaterialBlocks = [...homeScenes.matchAll(/new THREE\.PointsMaterial\(\{([\s\S]*?)\}\)/g)].map(([, block]) => block);
const pointSizes = pointMaterialBlocks.flatMap((block) =>
  [...block.matchAll(/size:\s*(?:compact\s*\?\s*)?([0-9.]+)/g)].map(([, size]) => Number(size))
);
assert.ok(pointSizes.length >= 3 && pointSizes.every((size) => size > 0 && size <= 0.05),
  "homepage point materials must not create oversized square overlays");
assert.ok(globals.includes("--accent: #7b3f58;") &&
  globals.includes("--signal: #d6a443;") &&
  globals.includes("color-scheme: light") &&
  sections.includes("var(--accent)") &&
  homeScenes.includes('new THREE.Color("#7b3f58")'),
  "the new plum-and-brass editorial palette must be used across the homepage");
assert.ok(!/(#c6e887|#7d83ff|#ff8a70|198,\s*232,\s*135|125,\s*131,\s*255)/i.test(globals + sections + homeScenes),
  "previous homepage palettes must be fully removed");
assert.ok(page.includes('className="home-scene-slot home-scene-slot--orbit"') &&
  page.includes('className="home-scene-slot home-scene-slot--flow"'),
  "each internal animation must live in its own inter-section slot");
const manifestoEnd = page.indexOf("</section>", page.indexOf('className="manifesto section"'));
const orbitSlot = page.indexOf('className="home-scene-slot home-scene-slot--orbit"');
const expertiseStart = page.indexOf('<section className="expertise section"');
const methodEnd = page.indexOf("</section>", page.indexOf('className="method section"'));
const flowSlot = page.indexOf('className="home-scene-slot home-scene-slot--flow"');
const rexoStart = page.indexOf('<section className="rexo-section"');
assert.ok(orbitSlot > manifestoEnd && orbitSlot < expertiseStart,
  "orbit scene must be centered between manifesto and expertise sections");
assert.ok(flowSlot > methodEnd && flowSlot < rexoStart,
  "flow scene must be centered between method and Rexo sections");
const orbitSlotCss = sections.split(".home-scene-slot {")[1]?.split("}")[0] ?? "";
assert.ok(orbitSlotCss.includes("padding-block") && !orbitSlotCss.includes("border"),
  "floating scenes must use balanced vertical padding without a frame");
assert.ok(sections.includes(".home-scene {") && sections.includes("overflow: visible;") &&
  !sections.includes("border-block: 1px solid var(--line);"),
  "floating scenes must not be enclosed by top or bottom rules");
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



// Public homepage copy and heading semantics.
assert.ok(!content.includes('"SEO content"'), "the SEO content expertise tag must be removed");
assert.ok(content.includes('cta: { label: "Email Me"') && page.includes('className="contact__email"'),
  "the contact CTA must use the Email Me label");
assert.ok(content.includes('copyright: "© 2027 Aria Kianzad. All rights reserved."'),
  "the homepage footer year must be fixed to 2027");
assert.ok(page.includes('<h3 className="note-card__title">{item.title}</h3>'),
  "the personal blog card title must be a semantic H3");
assert.equal([...page.matchAll(/<h1[ >]/g)].length, 1, "the homepage must contain exactly one H1");
const headingLevels = [...page.matchAll(/<h([1-6])[ >]/g)].map(([, level]) => Number(level));
assert.ok(headingLevels.length > 0 && headingLevels[0] === 1 &&
  headingLevels.every((level, index) => index === 0 || level <= headingLevels[index - 1] + 1),
  "homepage headings must follow a logical hierarchy without skipped levels");
// H4 is not needed: the current H3 elements are leaf-level subsections.
assert.ok(!page.includes("<h4"), "no H4 is needed without a subsection nested under an H3");

// Footer text uses dedicated light-on-dark tokens and meets WCAG AA.
assert.ok(chrome.includes("color: var(--panel-ink);") &&
  chrome.includes("color: var(--panel-muted);") &&
  chrome.includes("color: var(--panel-ink-soft);") &&
  chrome.includes("border-bottom: 1px solid var(--panel-line);"),
  "footer text and dividers must use the dark-panel tokens");
const readColorToken = (name) => {
  const declaration = globals.split(name + ": ")[1];
  const match = declaration?.match(/^(#[0-9a-f]{6})/i);
  assert.ok(match, `missing color token ${name}`);
  return match[1];
};
const rgbLinear = (hex) => [1, 3, 5].map((offset) => {
  const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
});
const luminance = (hex) => {
  const [r, g, b] = rgbLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastRatio = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};
const footerBackground = readColorToken("--panel-dark");
assert.ok(contrastRatio(readColorToken("--panel-muted"), footerBackground) >= 4.5 &&
  contrastRatio(readColorToken("--panel-ink"), footerBackground) >= 4.5 &&
  contrastRatio(readColorToken("--panel-ink-soft"), footerBackground) >= 4.5,
  "footer normal text colors must meet WCAG AA contrast against the dark panel");
assert.ok(chrome.includes("@media (max-width: 780px)") &&
  chrome.includes(".site-footer__top") &&
  chrome.includes("flex-wrap: wrap;"),
  "footer layout must retain its stacked and wrapping responsive treatment");

const socialHoverRule = chrome.split(".social-link:hover {")[1]?.split("}")[0] ?? "";
assert.ok(socialHoverRule.includes("transform: translateY(-3px);") &&
  socialHoverRule.includes("color: var(--signal-soft);") &&
  !socialHoverRule.includes("border") &&
  !socialHoverRule.includes("background"),
  "social icon hover must only lift the icon and change its color, without a frame or background");
assert.ok(!chrome.includes("border: 1px solid transparent;") &&
  !chrome.includes("background: rgba(214, 164, 67, 0.14);"),
  "social icon links must not reserve or reveal a square hover frame");


// The primary CTA stays in place on hover; only its arrow moves subtly.
const primaryButtonCss = globals.split(".button {")[1]?.split("/* Scroll-triggered reveal")[0] ?? "";
assert.ok(primaryButtonCss.includes("transform: none;") &&
  !primaryButtonCss.includes("translateY(-3px)") &&
  primaryButtonCss.includes("background: var(--accent-dark)") &&
  primaryButtonCss.includes("transform: translate(2px, -2px);"),
  "primary CTA hover must avoid the previous floating lift and keep arrow motion subtle");

// Keep canonical, robots, social and entity metadata intact.
assert.ok(metadata.includes('alternates: { canonical: "/" }') &&
  metadata.includes("robots:") &&
  metadata.includes('card: "summary_large_image"'),
  "homepage canonical, robots and social metadata must remain defined");
assert.ok(layout.includes('"@type": "ProfilePage"') &&
  layout.includes('"@type": "Person"') &&
  layout.includes('"@type": "WebSite"'),
  "homepage structured data graph must keep its page, person and website entities");

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
assert.ok(mobileNavigation.includes(".header-cta {") && mobileNavigation.includes("display: none;"),
  "the Let's talk header action must be hidden at the mobile breakpoint");
const narrowHeader = chrome.split("@media (max-width: 480px)")[1]?.split("@media (max-width: 360px)")[0] ?? "";
assert.ok(narrowHeader.includes(".wordmark__copy small {\n    display: none;"),
  "small screens must retain the compact wordmark lockup");
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
assert.ok(llms.includes("## Personal blog") && llms.includes("https://ariakianzad.github.io/blog/") && llms.includes("https://ariakianzad.github.io/blog/feed.xml"), "llms.txt must identify the first-party blog and its RSS feed");
assert.ok(llms.includes("creative agency"), "llms.txt must describe Rexo as an agency");

// Security invariants: no new external runtime origin, unsafe inline JS or eval.
assert.ok(layout.includes("Content-Security-Policy"), "CSP meta policy must remain in the root layout");
assert.ok(!/unsafe-inline|unsafe-eval/.test(layout), "CSP must not allow unsafe inline code or eval");
assert.ok(!/eval\s*\(|new Function\s*\(/.test(heroScene), "3D scene must not use dynamic code execution");

console.log("Homepage redesign contract passed: semantic SEO, AI-readable copy, 3D hero, responsive and reduced-motion fallbacks, CSP, and no-JavaScript navigation.");
