import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [
  packageJson, fetchScript, imageScript, dataSource, markdownSource,
  listingPage, articlePage, categoryPage, rssRoute, blogCss, adminHtml,
  adminApp, adminEdge, publicRpcMigration, browserDenyMigration, snapshotMigration,
  publicHeader, workflow, sitemap, robots,
] = await Promise.all([
  read("package.json"),
  read("scripts/fetch-blog-content.mjs"),
  read("scripts/generate-blog-og.mjs"),
  read("src/lib/blog-data.ts"),
  read("src/lib/blog-markdown.ts"),
  read("src/app/blog/page.tsx"),
  read("src/app/blog/[slug]/page.tsx"),
  read("src/app/blog/category/[category]/page.tsx"),
  read("src/app/blog/feed.xml/route.ts"),
  read("src/app/blog/blog.css"),
  read("public/admin/blog/index.html"),
  read("public/admin/blog/app.js"),
  read("supabase/functions/blog-admin/index.ts"),
  read("supabase/migrations/20261123110500_harden_public_blog_rpc.sql"),
  read("supabase/migrations/20261123095924_deny_browser_access_to_blog_cms.sql"),
  read("supabase/migrations/20261123112000_separate_blog_published_snapshots.sql"),
  read("src/app/blog/BlogHeader.tsx"),
  read(".github/workflows/deploy.yml"),
  read("src/app/sitemap.ts"),
  read("src/app/robots.ts"),
]);

const categorySeoMigration = await read("supabase/migrations/20261123130000_add_category_level_seo.sql");
const scripts = JSON.parse(packageJson).scripts;
assert.ok(scripts.prebuild.includes("fetch-blog-content.mjs"), "prebuild must fetch the public blog payload");
assert.ok(scripts.prebuild.includes("generate-blog-og.mjs"), "prebuild must generate social images");
assert.ok(scripts.predev.includes("fetch-blog-content.mjs"), "local development must fetch public blog data");
assert.ok(fetchScript.includes("/rest/v1/rpc/get_public_blog_payload"), "static content must use the restricted public RPC");
assert.ok(fetchScript.includes(".cache/blog-content.json"), "build payload must remain in the ignored cache");
assert.ok(!fetchScript.includes("blog_posts"), "the public build must not query private CMS tables directly");
assert.ok(/resize\(\s*1200\s*,\s*630\s*,/.test(imageScript), "social images must be 1200x630");
assert.ok(imageScript.includes("sharp(") && imageScript.includes("jpeg({quality:88"), "social images must be optimized in the build");
assert.ok(dataSource.includes("readFileSync"), "blog data must be loaded at build time, not per public request");

assert.ok(listingPage.includes("getBlogPosts()") && listingPage.includes("BlogListingClient"), "the blog archive must be server-rendered with client search controls");
assert.ok(listingPage.includes('"@type": "Blog"'), "the archive must include Blog structured data");
assert.ok(articlePage.includes("generateStaticParams"), "published articles must be statically generated");
assert.ok(articlePage.includes('{ slug: "__empty__" }') && articlePage.includes("robots: { index: false, follow: false }"), "empty article fallback must remain noindex");
assert.ok(articlePage.includes('"@type": "Article"'), "articles must include Article structured data");
assert.ok(articlePage.includes('"@type": "FAQPage"'), "FAQ schema must be available");
assert.ok(articlePage.includes("canonical") && articlePage.includes("robots_index"), "article SEO must support canonical and robots directives");
assert.ok(articlePage.includes("openGraph:") && articlePage.includes("twitter:"), "article metadata must include OG and X cards");
assert.ok(articlePage.includes("extractToc"), "articles must support a table of contents");
assert.ok(categoryPage.includes("generateStaticParams"), "category archives must be static pages");
assert.ok(categoryPage.includes("settings.category_seo") && categoryPage.includes("meta_description"), "category archives must support separate metadata per category");
assert.ok(categoryPage.includes('{ category: "__empty__" }') && categoryPage.includes("robots:{index:false,follow:false}"), "empty category fallback must remain noindex");
assert.ok(rssRoute.includes("application/rss+xml"), "the blog must publish an RSS feed");
assert.ok(sitemap.includes("getBlogPosts()") && sitemap.includes("/blog/"), "sitemap must include published articles and blog archive");
assert.ok(robots.includes('disallow: ["/admin/", "/admin/blog/"]'), "robots.txt must disallow both admin areas");
assert.ok(!publicHeader.includes("/author/"), "no separate author archive should be generated");

assert.ok(markdownSource.includes("function esc(") && markdownSource.includes("function allowedUrl("), "Markdown rendering must escape HTML and validate links");
assert.ok(markdownSource.includes("https?:") && markdownSource.includes("mailto:"), "Markdown links must use an explicit safe URL allowlist");
assert.ok(markdownSource.includes("extractToc"), "Markdown headings must provide TOC data");

assert.ok(blogCss.includes("Estedad") && blogCss.includes("theme-white") && blogCss.includes("theme-warm"), "the public blog must use Estedad and the light theme variants");
assert.ok(blogCss.includes("--blog-heading-scale") && blogCss.includes("--blog-line-height"), "global editorial typography settings must apply to public content");

assert.ok(adminHtml.includes('id="login-email"') && adminHtml.includes('id="login-password"'), "CMS login must use email and password");
assert.ok(adminHtml.includes('id="login-form"') && !/sign.?up|register|create account/i.test(adminHtml), "CMS must not expose public registration");
assert.ok(adminHtml.includes('name="robots" content="noindex, nofollow, noarchive"'), "CMS admin must be noindex");
assert.ok(adminHtml.includes("Content-Security-Policy"), "CMS admin must have a restrictive CSP");
for (const id of ["post-seo-title","post-meta-description","post-focus-keyword","post-canonical","post-robots-index","seo-checks","post-faqs","hero-image-file","og-image-file","setting-og-file","remember-me","category-seo-list"]) {
  assert.ok(adminHtml.includes('id="' + id + '"'), "CMS editor is missing control #" + id);
}
assert.ok(adminHtml.includes("setting-heading-scale") && adminHtml.includes("setting-line-height"), "CMS settings must expose typography controls");
assert.ok(adminHtml.includes('data-value="H4"'), "CMS formatting toolbar must support H4");
assert.ok(!adminHtml.includes('id="post-robots-follow"'), "article editor must not expose a global link-follow checkbox");

assert.ok(adminApp.includes("/auth/v1/token?grant_type=password"), "CMS must use Supabase email/password authentication");
assert.ok(adminApp.includes("/functions/v1/blog-admin"), "privileged CMS actions must use the Edge Function");
assert.ok(adminApp.includes("createImageBitmap(file)") && adminApp.includes('canvasBlob(canvas,"image/webp"'), "CMS must compress images to WebP");
assert.ok(adminApp.includes("3*1024*1024"), "CMS must cap compressed image uploads");
assert.ok(adminApp.includes("previewInline"), "Markdown preview must use an escaped renderer");
assert.ok(!/localStorage|sessionStorage/.test(adminApp), "CMS session tokens must not be persisted in Web Storage");
assert.ok(adminApp.includes("PasswordCredential") && adminApp.includes("navigator.credentials.get") && adminApp.includes("preventSilentAccess"), "remember-me must rely on browser-managed credentials, not client-side token storage");
assert.ok(adminApp.includes("updateFormatToolbar") && adminApp.includes("getSelectedBlockquote") && adminApp.includes("unwrapBlockquote"), "format toolbar must reflect selection state and allow unwrapping blockquotes");
assert.ok(adminApp.includes("category_seo:collectCategorySeo") && adminApp.includes("renderCategorySeoEditor"), "CMS must edit and persist per-category SEO settings");
assert.ok(!/sb_secret_|service_role|GITHUB_WORKFLOW_TOKEN|ghp_/.test(adminApp), "privileged credentials must never enter the browser bundle");
assert.equal((adminApp.match(/function showView\(name\)/g) || []).length, 1, "CMS script must have one view switcher");

for (const invariant of [
  "auth.getUser(accessToken)", 'from("dashboard_admins")', '.eq("active", true)',
  "email_confirmed_at", "Access-Control-Allow-Origin", "GITHUB_WORKFLOW_TOKEN",
  "publicationPending",
  "published_snapshot", "has_unpublished_changes", "MAX_IMAGE_BYTES", "hasMagicBytes",
  "/actions/workflows/deploy.yml/dispatches",
]) {
  assert.ok(adminEdge.includes(invariant), "blog-admin is missing security or publishing invariant: " + invariant);
}
assert.ok(publicRpcMigration.includes("security invoker"), "public RPC wrapper must use SECURITY INVOKER");
assert.ok(browserDenyMigration.includes("revoke all on table public.blog_posts from anon, authenticated"), "browser roles must not read draft tables");
assert.ok(snapshotMigration.includes("p.published_snapshot") && snapshotMigration.includes("p.status = 'published'"), "the public RPC must only expose published snapshots");
assert.ok(categorySeoMigration.includes("category_seo jsonb") && categorySeoMigration.includes("security invoker"), "category SEO must be exposed through a restricted public payload");
assert.ok(workflow.includes("npm run test:blog"), "CI must run the blog CMS contract");

const siteChrome = await read("src/components/SiteChrome.tsx");
assert.ok(adminHtml.includes('contenteditable="true"'), "CMS must use a rich text editing surface");
assert.ok(adminHtml.includes('id="link-settings-toggle"') && adminHtml.includes('id="link-settings-list"'), "CMS must expose per-link controls");
assert.ok(adminApp.includes("sanitizeClipboardHtml") && adminApp.includes("handleEditorPaste"), "CMS must sanitize and preserve rich clipboard HTML");
assert.ok(adminApp.includes("editorToMarkdown") && adminApp.includes("refreshLinkManager"), "CMS must serialize rich text and expose per-link settings");
assert.ok(markdownSource.includes("rel=(follow|nofollow|sponsored|ugc)") && markdownSource.includes("target=(_blank|_self)"), "public Markdown renderer must preserve link relationship and target settings");
assert.ok(markdownSource.includes("<table>") && markdownSource.includes("<u>"), "public Markdown renderer must support pasted tables and underline");
assert.ok(siteChrome.includes("usePathname") && siteChrome.includes("isBlog"), "blog routes must not inherit the portfolio chrome");
assert.ok(listingPage.includes('settings.tagline || "یادداشت‌هایی درباره برند، معنا و ارتباط"'), "blog archive H1 must use the descriptive tagline");
assert.ok(blogCss.includes("body:has(.blog-theme)") && blogCss.includes("font-family:var(--font-estedad)"), "blog pages must keep their own shell and Estedad typography");
assert.ok(blogCss.includes(".blog-toc{display:none}") && blogCss.includes("height:clamp(112px,31vw,160px)"), "mobile article reading must hide secondary TOC and compact the featured image");
assert.ok(blogCss.includes("direction:rtl; text-align:right") && blogCss.includes(".blog-socials"), "blog footer must use RTL alignment and social icon links");
assert.ok(articlePage.indexOf("<h1>{post.title}</h1>") < articlePage.indexOf("<figure className=\"blog-hero-image\">"), "featured image must follow the article title");
assert.ok(publicHeader.includes("SocialIcon") && !publicHeader.includes("mailto:") && !publicHeader.includes("/#about"), "blog footer must remove email/about links and include social icons");

assert.ok(adminHtml.includes("مرا به خاطر بسپار") && !/EDITORIAL OVERVIEW|RECENT WORK|CONTENT LIBRARY|PRIVATE WORKSPACE|MAIN WEBSITE/.test(adminHtml), "CMS visible labels must be Persian and offer a remember-me option");
console.log("Personal blog contract passed: secure CMS, rich paste, category SEO, accessible formatting, responsive reading and isolated Persian editorial chrome.");
