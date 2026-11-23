import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const exists = async (path) => access(new URL("../" + path, import.meta.url)).then(() => true).catch(() => false);

const [
  schema,
  edge,
  deno,
  adminHtml,
  adminCss,
  adminJs,
  publicConfig,
  content,
  archive,
  article,
  category,
  pagination,
  blogCss,
  frame,
  sitemap,
  robots,
  feed,
  rootLayout,
  packageJson,
] = await Promise.all([
  read("supabase/migrations/20261123093525_create_secure_personal_blog_cms.sql"),
  read("supabase/functions/blog-admin/index.ts"),
  read("supabase/functions/blog-admin/deno.json"),
  read("public/blog-admin/index.html"),
  read("public/blog-admin/admin.css"),
  read("public/blog-admin/app.js"),
  read("public/blog-admin/config.js"),
  read("src/lib/blog-content.tsx"),
  read("src/app/blog/page.tsx"),
  read("src/app/blog/[slug]/page.tsx"),
  read("src/app/blog/category/[category]/page.tsx"),
  read("src/components/blog-pagination.tsx"),
  read("src/app/blog/blog.css"),
  read("src/components/blog-frame.tsx"),
  read("src/app/sitemap.ts"),
  read("src/app/robots.ts"),
  read("src/app/blog/feed.xml/route.ts"),
  read("src/app/layout.tsx"),
  read("package.json"),
]);

// Data separation and browser privilege boundaries.
assert.ok(schema.includes("create table if not exists public.blog_posts"), "blog_posts table missing");
assert.ok(schema.includes("create table if not exists public.blog_settings"), "blog_settings table missing");
assert.ok(schema.includes("alter table public.blog_posts enable row level security"), "blog_posts RLS missing");
assert.ok(schema.includes("alter table public.blog_settings enable row level security"), "blog_settings RLS missing");
assert.ok(schema.includes("revoke all on table public.blog_posts from anon, authenticated, public"), "blog_posts must not be directly accessible to browser roles");
assert.ok(schema.includes("revoke all on table public.blog_settings from anon, authenticated, public"), "blog_settings must not be directly accessible to browser roles");
assert.ok(schema.includes("grant all on table public.blog_posts to service_role"), "blog_posts must be server-only");
assert.ok(schema.includes("grant all on table public.blog_settings to service_role"), "blog_settings must be server-only");
assert.ok(schema.includes("'blog-media'") && schema.includes("8388608"), "the image bucket must enforce an 8MB limit");
assert.ok(schema.includes("image/webp") && schema.includes("image/jpeg") && schema.includes("image/png"), "the media bucket must restrict image MIME types");
assert.ok(schema.includes('to anon, authenticated'), "public blog media needs read-only public access");

// Supabase Edge Function enforces both Auth and administrator allowlisting.
assert.ok(edge.includes("auth.getUser(token)"), "the Edge Function must validate the access token with Supabase Auth");
assert.ok(edge.includes('from("dashboard_admins")'), "the Edge Function must use the server-side admin allowlist");
assert.ok(edge.includes('.eq("active", true)'), "the Edge Function must require an active administrator");
assert.ok(edge.includes("email_confirmed_at") && edge.includes("confirmed_at"), "the Edge Function must require a confirmed email");
assert.ok(edge.includes('claims.aal !== "aal2"'), "the Edge Function must require second-factor AAL2");
assert.ok(edge.includes('Access-Control-Allow-Origin": SITE_ORIGIN'), "the Edge Function must pin CORS to the website origin");
assert.ok(edge.includes('"Cache-Control": "no-store"'), "admin API responses must not be cached");
assert.ok(edge.includes('Deno.env.get("BLOG_GITHUB_TOKEN")'), "publishing must use a server-side GitHub secret");
assert.ok(edge.includes('from("blog_posts")') && edge.includes('from("blog_settings")'), "the Edge Function must own database access");
assert.ok(edge.includes("createSignedUploadUrl"), "media uploads must use signed upload URLs");
assert.ok(edge.includes("src/content/blog/") && edge.includes("upsertPublishedFile"), "publication must create a static public content file");
assert.ok(edge.includes("deletePublishedFile"), "unpublishing must remove the public static content file");
assert.ok(edge.includes("safeSlug") && edge.includes("validateForPublish"), "slug and required publish fields must be validated");
assert.ok(JSON.parse(deno).imports["@supabase/supabase-js"] === "npm:@supabase/supabase-js@2.119.2",
  "the Supabase SDK must be pinned in the Deno import map");
assert.ok(!/BLOG_GITHUB_TOKEN|sb_secret_|service_role|private_key/.test(adminJs + publicConfig),
  "browser assets must never contain privileged credentials");
assert.ok(publicConfig.includes("sb_publishable_"), "browser config must use only the Supabase publishable key");
assert.ok(!adminJs.includes("localStorage") && !adminJs.includes("sessionStorage"),
  "the admin JWT must not be persisted in browser storage");

// Login, TOTP and CSP guardrails.
assert.ok(adminHtml.includes('name="email"') && adminHtml.includes('name="password"'), "email/password sign-in fields missing");
assert.ok(adminHtml.includes('id="mfa-challenge-view"') && adminHtml.includes('id="mfa-enroll-view"'), "TOTP challenge and setup screens are required");
assert.ok(adminJs.includes("/auth/v1/factors") && adminJs.includes("/verify") && adminJs.includes("aal2"),
  "the client must enroll and verify TOTP before opening the CMS");
assert.ok(adminHtml.includes('noindex, nofollow, noarchive'), "the private admin must be excluded from search indexing");
assert.ok(adminHtml.includes("frame-ancestors 'none'") && adminHtml.includes("object-src 'none'"), "admin CSP must block framing and plugin objects");
assert.ok(adminHtml.includes("style-src 'self'") && adminHtml.includes("script-src 'self'"), "admin CSP must not permit inline scripts or styles");
assert.ok(adminHtml.includes("connect-src 'self' https://bkohdqwecnvbmeaiuyyx.supabase.co"), "admin CSP must restrict API connections");
assert.ok(adminHtml.includes("https://bkohdqwecnvbmeaiuyyx.supabase.co;"), "admin image policy must allow blog media");

// Editor, safe previews, SEO and automated image compression.
assert.ok(adminHtml.includes('id="post-content"') && adminHtml.includes('id="live-preview"'), "editor and live preview must be present");
assert.ok(adminHtml.includes('data-editor-tab="seo"') && adminHtml.includes('id="seo-checks"'), "SEO controls and checks are required");
assert.ok(adminHtml.includes('id="hero-image-file"') && adminHtml.includes('id="media-grid"'), "image upload and media library are required");
assert.ok(adminJs.includes("createImageBitmap") && adminJs.includes('toBlob("image/webp", 0.84)'),
  "the admin must automatically resize and compress images to WebP");
assert.ok(adminJs.includes("maxSide = 2400") && adminJs.includes("۸ مگابایت"),
  "image processing must downscale very large images and respect the bucket limit");
assert.ok(adminJs.includes("safePreviewUrl") && adminJs.includes("escapeHtml"),
  "live preview must escape raw text and validate link destinations");
assert.ok(!adminJs.includes("dangerouslySetInnerHTML"), "the admin must not use React unsafe HTML rendering");
assert.ok(content.includes("function safeLink") && content.includes("function safeImage"), "public Markdown renderer must validate link and image destinations");
assert.ok(!content.includes("dangerouslySetInnerHTML"), "raw Markdown HTML must not be injected into public article content");
assert.ok(content.includes("createElement(\"strong\"") && content.includes("createElement(\"blockquote\""),
  "Markdown renderer must create structured React nodes rather than injecting HTML");
assert.ok(adminJs.includes('await saveDraft();\n    const result = await edgeAction("publish_post"'),
  "publishing must first save the latest editor contents");

// Public content and search metadata.
assert.ok(archive.includes("generateMetadata") && archive.includes("BlogPagination"), "archive metadata and pagination are required");
assert.ok(article.includes("generateStaticParams") && article.includes("generateMetadata"), "articles must be statically generated with page metadata");
assert.ok(article.includes("Article") && article.includes("FAQPage") && article.includes("canonical"), "article schema, FAQ and canonical handling are required");
assert.ok(category.includes("generateStaticParams") && category.includes("category"), "static category archives are required");
assert.ok(pagination.includes("/blog/page/"), "archive pagination must use canonical static URLs");
assert.ok(feed.includes("application/rss+xml") || feed.includes("application/rss+xml; charset=utf-8"), "RSS output must be available");
assert.ok(sitemap.includes("getPublishedPosts") && sitemap.includes("getBlogCategories"), "published articles and categories must be included in the sitemap");
assert.ok(sitemap.includes("robotsIndex !== false"), "noindex articles must not be added to the sitemap");
assert.ok(robots.includes("/blog-admin/"), "the admin route must be excluded from crawlers");
assert.ok(rootLayout.includes("https://bkohdqwecnvbmeaiuyyx.supabase.co"), "root CSP must allow the blog media origin");
assert.ok(rootLayout.includes('href="/blog/"'), "the main website must link to the blog");
assert.ok(blogCss.includes("Estedad") === false, "blog CSS must inherit the site's Estedad variable font");
assert.ok(blogCss.includes("blog-theme-paper") && blogCss.includes("blog-theme-white") && blogCss.includes("blog-theme-warm"),
  "the public blog must expose the three configurable light themes");
assert.ok(frame.includes("blog-accent-forest") && frame.includes("blog-accent-terracotta"), "public accent palettes must be mapped to safe CSS classes");
assert.ok(!await exists("src/app/blog/author/[slug]/page.tsx"), "a separate author page must not be generated");

console.log("Blog CMS contract passed: private drafts, admin allowlist + TOTP, non-persisted sessions, signed media upload, safe Markdown, SEO metadata, static publishing, RSS and sitemap.");
