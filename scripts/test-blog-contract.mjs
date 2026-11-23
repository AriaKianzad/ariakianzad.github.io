import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [
  packageJson, fetchScript, imageScript, dataSource, markdownSource,
  listingPage, articlePage, categoryPage, rssRoute, blogCss, adminHtml,
  adminApp, adminEdge, publicFeedMigration, snapshotMigration, publicHeader,
  workflow, sitemap, robots,
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
  read("supabase/migrations/20261123112000_separate_blog_published_snapshots.sql"),
  read("src/app/blog/BlogHeader.tsx"),
  read(".github/workflows/deploy.yml"),
  read("src/app/sitemap.ts"),
  read("src/app/robots.ts"),
]);

const scripts = JSON.parse(packageJson).scripts;
assert.ok(scripts.prebuild.includes("fetch-blog-content.mjs"), "the static build must fetch the published-only blog payload");
assert.ok(scripts.prebuild.includes("generate-blog-og.mjs"), "the static build must generate social preview images");
assert.ok(scripts.predev.includes("fetch-blog-content.mjs"), "local development must fetch the published-only blog payload");
assert.ok(fetchScript.includes("/rest/v1/rpc/get_public_blog_payload"), "the build must use the constrained public RPC");
assert.ok(fetchScript.includes("sb_publishable_"), "the build fetch must only read the public Supabase key");
assert.ok(fetchScript.includes(".cache/blog-content.json"), "the published payload must stay in the ignored build cache");
assert.ok(!fetchScript.includes("blog_posts"), "the public build must not query draft tables directly");
assert.ok(imageScript.includes("resize(1200, 630"), "article Open Graph images must be generated at 1200×630");
assert.ok(imageScript.includes("jpeg({quality:88"), "article social images must be optimized as JPEG");
assert.ok(imageScript.includes("sharp("), "image processing must run in the build pipeline");

assert.ok(listingPage.includes("getBlogPosts()"), "the public archive must be server-rendered from the static payload");
assert.ok(listingPage.includes('"@type": "Blog"'), "the blog archive must include Blog structured data");
assert.ok(listingPage.includes("BlogListingClient"), "the public archive must include interactive search and filtering");
assert.ok(articlePage.includes("generateStaticParams"), "published article routes must be generated during build");
assert.ok(articlePage.includes('"@type": "Article"'), "article pages must include Article structured data");
assert.ok(articlePage.includes('"@type": "FAQPage"'), "FAQ structured data must be available when FAQs exist");
assert.ok(articlePage.includes("alternates: { canonical"), "article pages must expose canonical URLs");
assert.ok(articlePage.includes("robots_index"), "article pages must support individual index directives");
assert.ok(articlePage.includes("openGraph:"), "article pages must expose Open Graph metadata");
assert.ok(articlePage.includes("twitter:"), "article pages must expose Twitter/X card metadata");
assert.ok(articlePage.includes("extractToc"), "article pages must support a generated table of contents");
assert.ok(categoryPage.includes("generateStaticParams"), "category pages must be statically generated");
assert.ok(rssRoute.includes("application/rss+xml"), "the public blog must provide an RSS feed");
assert.ok(sitemap.includes("getBlogPosts()") && sitemap.includes("/blog/"), "the sitemap must include the blog and published articles");
assert.ok(robots.includes('disallow: ["/admin/", "/admin/blog/"]'), "robots.txt must disallow private admin routes");
assert.ok(!publicHeader.includes("/author/"), "the personal blog must not create a separate author page");

assert.ok(markdownSource.includes("function esc("), "the Markdown renderer must HTML-escape source content");
assert.ok(markdownSource.includes("function allowedUrl("), "the Markdown renderer must validate link and image schemes");
assert.ok(markdownSource.includes('!/^\\/\\//.test(v)'), "the Markdown renderer must reject protocol-relative URLs");
assert.ok(markdownSource.includes("extractToc"), "the Markdown renderer must expose heading metadata");

assert.ok(adminHtml.includes('id="login-email"') && adminHtml.includes('id="login-password"'), "the private CMS must require email and password");
assert.ok(adminHtml.includes('id="login-form"'), "the private CMS must have a sign-in form");
assert.ok(!/sign.?up|register|create account/i.test(adminHtml), "the private CMS must not expose public registration");
assert.ok(adminHtml.includes('name="robots" content="noindex, nofollow, noarchive"'), "the admin page must be noindex");
assert.ok(adminHtml.includes("Content-Security-Policy"), "the admin page must carry a restrictive CSP");
assert.ok(adminHtml.includes('id="post-seo-title"') && adminHtml.includes('id="post-meta-description"'), "the editor must expose SEO title and meta description");
assert.ok(adminHtml.includes('id="post-focus-keyword"') && adminHtml.includes('id="post-canonical"'), "the editor must expose focus keyword and canonical URL");
assert.ok(adminHtml.includes('id="post-robots-index"') && adminHtml.includes('id="post-robots-follow"'), "the editor must expose robots directives");
assert.ok(adminHtml.includes('id="seo-checks"'), "the editor must include an SEO checklist");
assert.ok(adminHtml.includes('id="post-faqs"'), "the editor must support FAQ structured content");
assert.ok(adminHtml.includes('id="hero-image-file"') && adminHtml.includes('id="og-image-file"'), "the editor must support cover and social images");
assert.ok(adminHtml.includes('id="setting-heading-scale"') && adminHtml.includes('id="setting-line-height"'), "the settings must expose typography customization");

assert.ok(adminApp.includes("/auth/v1/token?grant_type=password"), "the admin must sign in through Supabase email/password auth");
assert.ok(adminApp.includes("/functions/v1/blog-admin"), "admin operations must use the protected Edge Function");
assert.ok(adminApp.includes("createImageBitmap(file)"), "images must be resized and compressed in the browser before upload");
assert.ok(adminApp.includes('canvasBlob(canvas,"image/webp",0.84)'), "image compression must output WebP");
assert.ok(adminApp.includes("3*1024*1024"), "the editor must cap compressed uploads at 3 MB");
assert.ok(adminApp.includes("previewInline"), "the Markdown preview must use an escaped rendering path");
assert.ok(!/localStorage|sessionStorage/.test(adminApp), "the admin must not persist access or refresh tokens in browser storage");
assert.ok(!/sb_secret_|service_role|GITHUB_WORKFLOW_TOKEN|ghp_/.test(adminApp), "the public admin bundle must not contain privileged credentials");
assert.equal((adminApp.match(/function showView\(name\)/g) || []).length, 1, "the admin script must have one view switcher");

for (const invariant of [
  "auth.getUser(accessToken)",
  'from("dashboard_admins")',
  '.eq("active", true)',
  "email_confirmed_at",
  "Access-Control-Allow-Origin",
  "GITHUB_WORKFLOW_TOKEN",
  "createClient(config.url, config.secret",
  "hasMagicBytes",
  "MAX_IMAGE_BYTES",
  "published_snapshot",
  "has_unpublished_changes",
]) {
  assert.ok(adminEdge.includes(invariant), "blog-admin must retain security/content invariant: " + invariant);
}
assert.ok(adminEdge.includes('"/actions/workflows/deploy.yml/dispatches"'), "publish must trigger the GitHub Pages build");
assert.ok(adminEdge.includes('message.includes("GITHUB_WORKFLOW_TOKEN")'), "missing publish secret must return an explicit configuration status");
assert.ok(publicFeedMigration.includes("security invoker"), "public blog RPC must use a SECURITY INVOKER wrapper");
assert.ok(publicFeedMigration.includes("revoke all on table public.blog_posts from anon, authenticated"), "browser roles must not read draft tables directly");
assert.ok(snapshotMigration.includes("p.published_snapshot"), "the public feed must read immutable published snapshots");
assert.ok(snapshotMigration.includes("p.status = 'published'"), "the public feed must exclude drafts and archived posts");
assert.ok(workflow.includes("npm run test:blog"), "CI must run the blog CMS contract test");

console.log("Personal blog contract passed: static SEO routes, published-only content, secure admin auth, image compression and editorial controls.");
