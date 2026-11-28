import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script, runInNewContext } from "node:vm";
import ts from "typescript";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [
  packageJson, fetchScript, imageScript, dataSource, markdownSource,
  listingPage, articlePage, categoryPage, rssRoute, blogCss, adminHtml, adminCss,
  adminApp, adminEdge, publicRpcMigration, browserDenyMigration, snapshotMigration,
  publicHeader, workflow, sitemap, robots, heroVisualComponent, signalScene, heroBootstrap, staticHostHeaders, apacheHeaders,
  blogLayout, contactPage, contactForm, contactEdge, contactMigration, rootLayout, configToml, googleContactScript, contactBrowserScript,
  adClickTracker, adClickEdge, adClickMigration, adClickExpansionMigration, adClickHardeningMigration,
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
  read("public/admin/blog/blog.css"),
  read("public/admin/blog/app.js"),
  read("supabase/functions/blog-admin/index.ts"),
  read("supabase/migrations/20261123112106_harden_public_blog_rpc.sql"),
  read("supabase/migrations/20261123095924_deny_browser_access_to_blog_cms.sql"),
  read("supabase/migrations/20261123112448_separate_blog_published_snapshots.sql"),
  read("src/app/blog/BlogHeader.tsx"),
  read(".github/workflows/deploy.yml"),
  read("src/app/sitemap.ts"),
  read("src/app/robots.ts"),
  read("src/components/hero-visual.tsx"),
  read("src/client/signal-scene.ts"),
  read("src/client/hero-visual.ts"),
  read("public/_headers"),
  read("public/.htaccess"),
  read("src/app/blog/layout.tsx"),
  read("src/app/blog/contact/page.tsx"),
  read("src/app/blog/contact/ContactForm.tsx"),
  read("supabase/functions/blog-contact/index.ts"),
  read("supabase/migrations/20261123150911_add_blog_contact_rate_limit.sql"),
  read("src/app/layout.tsx"),
  read("supabase/config.toml"),
  read("integrations/google-apps-script/blog-contact.gs"),
  read("public/blog-contact.js"),
  read("public/blog-ad-click.js"),
  read("supabase/functions/blog-ad-click/index.ts"),
  read("supabase/migrations/20261125115301_add_blog_ad_click_tracking.sql"),
  read("supabase/migrations/20261125120557_expand_blog_ad_banner_ids.sql"),
  read("supabase/migrations/20261125170128_harden_blog_rate_limits_and_contact_cleanup.sql"),
]);


const [analyticsEdge, adBannerMigration, siteConfig, socialIcons, socialIconExtractor, telegramIconSource] = await Promise.all([
  read("supabase/functions/site-analytics/index.ts"),
  read("supabase/migrations/20261124075303_global_article_advertising_slots.sql"),
  read("src/lib/site.ts"),
  read("src/lib/social-icons.json"),
  read("scripts/extract-social-paths.mjs"),
  read("assets-src/icons/telegram.svg"),
]);

const blogChromeCss = await read("src/app/chrome.css");
const categorySeoMigration = await read("supabase/migrations/20261123143405_add_category_level_seo.sql");
const cultureRenameMigration = await read("supabase/migrations/20261125122854_rename_culture_display_name_to_culture_and_media.sql");
const categoryTaxonomyMigration = await read("supabase/migrations/20261123194500_add_blog_category_taxonomy_and_advanced_seo.sql");
const multipleCategoryMigration = await read("supabase/migrations/20261123212331_add_multiple_post_categories.sql");
const snapshotCategorySyncMigration = await read("supabase/migrations/20261123215838_sync_multi_category_published_snapshots.sql");
const canonicalMigration = await read("supabase/migrations/20261123230705_add_blog_default_canonical_url.sql");
const responsiveAdMigration = await read("supabase/migrations/20261124111304_responsive_article_advertising.sql");
const categoryUtils = await read("src/lib/blog-category-utils.ts");
const listingClient = await read("src/app/blog/BlogListingClient.tsx");
const listingScript = await read("public/blog-listing.js");
new Script(listingScript, { filename: "public/blog-listing.js" });
const listingEvents = {};
const makeListingCard = (slug, category, searchable) => ({
  hidden:false,
  dataset:{categorySlugs:category,searchText:searchable},
});
const listingCards = [
  makeListingCard("brand-strategy","branding","استراتژی برند"),
  makeListingCard("culture-notes","culture","فرهنگ روزمره"),
];
const makeFilter = (category) => ({
  dataset:{categoryFilter:category},
  classList:{toggle(){}},
  attributes:{},
  setAttribute(name,value){this.attributes[name]=value;},
  addEventListener(type,handler){listingEvents["filter:"+category+":"+type]=handler;},
});
const listingFilters = [makeFilter(""),makeFilter("branding"),makeFilter("culture")];
const listingSearch = {value:"",addEventListener(type,handler){listingEvents["search:"+type]=handler;},focus(){}};
const listingMore = {addEventListener(type,handler){listingEvents["more:"+type]=handler;}};
const listingClear = {hidden:true,addEventListener(type,handler){listingEvents["clear:"+type]=handler;}};
const listingMoreWrap = {hidden:true};
const listingEmpty = {hidden:true};
const listingResults = {textContent:""};
const listingWidget = {
  dataset:{pageSize:"1"},
  classList:{add(){}},
  querySelectorAll(selector){return selector==="[data-blog-post-card]"?listingCards:selector==="[data-category-filter]"?listingFilters:[];},
  querySelector(selector){
    return ({
      "[data-blog-search]":listingSearch,
      "[data-blog-results]":listingResults,
      "[data-clear-blog-filters]":listingClear,
      "[data-blog-empty]":listingEmpty,
      "[data-blog-load-more]":listingMoreWrap,
      "[data-load-more]":listingMore,
    })[selector]||null;
  },
};
runInNewContext(listingScript,{document:{querySelectorAll:()=>[listingWidget]}});
assert.equal(listingCards[0].hidden,false,"the first matching article card must be visible on initial render");
assert.equal(listingCards[1].hidden,true,"load-more must initially hide cards outside the page size");
assert.equal(listingMoreWrap.hidden,false,"load-more must appear when more articles exist");
listingEvents["more:click"]();
assert.equal(listingCards[1].hidden,false,"load-more must reveal the next page of articles");
listingEvents["filter:branding:click"]();
assert.equal(listingCards[0].hidden,false,"the chosen category must retain matching articles");
assert.equal(listingCards[1].hidden,true,"the chosen category must hide non-matching articles");
listingEvents["filter:culture:click"]();
listingSearch.value="فرهنگ";
listingEvents["search:input"]();
assert.equal(listingCards[0].hidden,true,"search must hide cards whose searchable text does not match");
assert.equal(listingCards[1].hidden,false,"search must show matching cards in the currently selected category");

const copyLinkButton = await read("src/app/blog/CopyLinkButton.tsx");
const blogCopyScript = await read("public/blog-copy.js");
new Script(blogCopyScript, { filename: "public/blog-copy.js" });

const copyHandlers = {};
let copiedUrl = "";
const copyFeedback = { hidden: true, textContent: "", classList: { toggle() {} } };
const manualPanel = { hidden: true };
const copyWrapper = {
  querySelector(selector) {
    if (selector === "[data-copy-feedback]") return copyFeedback;
    if (selector === "[data-copy-manual-wrap]") return manualPanel;
    return null;
  },
};
const copyButton = {
  disabled: false,
  dataset: {},
  closest(selector) {
    return selector === ".blog-share-copy-wrap" ? copyWrapper : null;
  },
  getAttribute(name) {
    return name === "data-copy-url" ? "https://ariakianzad.github.io/blog/copy-test/" : null;
  },
  setAttribute() {},
  removeAttribute() {},
};
const copyDocument = {
  addEventListener(type, handler) {
    copyHandlers[type] = handler;
  },
};
runInNewContext(blogCopyScript, {
  document: copyDocument,
  navigator: { clipboard: { writeText: async (value) => { copiedUrl = value; } } },
  window: { isSecureContext: true, setTimeout: () => 1, clearTimeout() {} },
});
assert.equal(typeof copyHandlers.click, "function", "static copy script must register a document-level click handler");
await copyHandlers.click({
  target: { closest: (selector) => selector === "[data-copy-link]" ? copyButton : null },
  preventDefault() {},
});
assert.equal(copiedUrl, "https://ariakianzad.github.io/blog/copy-test/", "copy click must send the canonical article URL to the clipboard");
assert.equal(copyFeedback.textContent, "لینک کپی شد", "successful copy must show the Persian success toast");
assert.equal(copyFeedback.hidden, false, "successful copy toast must become visible");
const analyticsConsent = await read("public/analytics-consent.js");
const notFoundContent = await read("src/app/NotFoundContent.tsx");
const notFoundCss = await read("src/app/not-found.css");
const blogNotFound = await read("src/app/blog/not-found.tsx");
const legacyCategoryMigration = await read("supabase/migrations/20261123202602_cleanup_legacy_persian_blog_category.sql");
const legacyCategoryRedirect = await read("public/blog/category/برند-و-کسب‌وکار/index.html");
new Script(contactBrowserScript, { filename: "public/blog-contact.js" });
new Script(googleContactScript, { filename: "integrations/google-apps-script/blog-contact.gs" });
const scripts = JSON.parse(packageJson).scripts;
assert.ok(scripts.prebuild.includes("fetch-blog-content.mjs"), "prebuild must fetch the public blog payload");
assert.ok(scripts.prebuild.includes("generate-blog-og.mjs"), "prebuild must generate social images");
assert.ok(scripts.predev.includes("fetch-blog-content.mjs"), "local development must fetch public blog data");
assert.ok(fetchScript.includes("/rest/v1/rpc/get_public_blog_payload"), "static content must use the restricted public RPC");
assert.ok(fetchScript.includes(".cache/blog-content.json"), "build payload must remain in the ignored cache");
assert.ok(!fetchScript.includes("blog_posts"), "the public build must not query private CMS tables directly");
assert.ok(/resize\(\s*1200\s*,\s*630\s*,/.test(imageScript), "social images must be 1200x630");
assert.ok(imageScript.includes("sharp(") && imageScript.includes("jpeg({quality:88"), "social images must be optimized in the build");
assert.ok(imageScript.includes("trustedMediaUrl") && imageScript.includes('url.origin!==MEDIA_ORIGIN') && imageScript.includes('url.protocol!=="https:"') && imageScript.includes('redirect:"error"') && imageScript.includes("MAX_MEDIA_BYTES"), "social preview generation must fetch only bounded images from the project's public blog-media bucket");
assert.ok(dataSource.includes("readFileSync"), "blog data must be loaded at build time, not per public request");

assert.ok(listingPage.includes("getBlogPosts()") && listingPage.includes("BlogListingClient"), "the blog archive must be server-rendered with client search controls");
assert.ok(listingScript.includes("data-blog-listing") && listingScript.includes("includes(activeCategory)") && listingScript.includes("visibleLimit += pageSize"), "standalone listing script must provide search, category filtering and load-more behavior");
assert.ok(blogLayout.includes('<script src="/blog-listing.js" defer />'), "static blog search behavior must load as a same-origin script on blog routes");
assert.ok(listingPage.includes('"@type": "Blog"'), "the archive must include Blog structured data");
assert.ok(listingPage.includes("description: settings.description || settings.default_meta_description || undefined"), "Blog structured data must fall back to the configured meta description when the editorial description is empty");
assert.ok(articlePage.includes("generateStaticParams"), "published articles must be statically generated");
assert.ok(articlePage.includes('{ slug: "__empty__" }') && articlePage.includes("robots: { index: false, follow: false }"), "empty article fallback must remain noindex");
assert.ok(articlePage.includes('"@context": "https://schema.org"') && articlePage.includes('"@type": settings.schema_type'), "articles must use the configured structured data type");
assert.ok(articlePage.includes('"@type": "FAQPage"'), "FAQ schema must be available");
assert.ok(articlePage.includes("canonical") && articlePage.includes("robots_index"), "article SEO must support canonical and robots directives");
assert.ok(articlePage.includes("openGraph:") && articlePage.includes("twitter:"), "article metadata must include OG and X cards");
assert.ok(articlePage.includes('const image = site.url + "/og/blog/" + post.slug + ".jpg?v=20261128-1"'), "article OG and X metadata must use the normalized 1200x630 build asset rather than the raw uploaded image");
assert.ok(contactPage.includes('images: [{ url: site.url + "/og/og.jpg", width: 1200, height: 630 }]') && contactPage.includes('card: "summary_large_image"'), "blog contact metadata must include a large social preview image");
assert.ok(articlePage.includes("extractToc"), "articles must support a table of contents");
assert.ok(categoryPage.includes("generateStaticParams"), "category archives must be static pages");
assert.ok(categoryPage.includes("settings.category_seo") && categoryPage.includes("meta_description"), "category archives must support separate metadata per category");
assert.ok(categoryPage.includes('{ category: "__empty__" }') && categoryPage.includes("robots: { index: false, follow: false }"), "empty category fallback must remain noindex");
assert.ok(rssRoute.includes("application/rss+xml"), "the blog must publish an RSS feed");
assert.ok(rssRoute.includes("post.canonical_url || site.url + \"/blog/\" + post.slug + \"/\"") && rssRoute.includes("settings.canonical_url || site.url + \"/blog/\""), "RSS item and channel links must stay aligned with the canonical blog URLs");
assert.ok(blogCss.includes("@media(prefers-reduced-motion:reduce)") && blogCss.includes("animation-duration:.01ms") && blogCss.includes("transition-duration:.01ms"), "the public blog must honour reduced-motion preferences");
assert.ok(adminCss.includes("@media(prefers-reduced-motion:reduce)") && adminCss.includes("animation-duration:.01ms") && adminCss.includes("transition-duration:.01ms"), "the blog CMS must honour reduced-motion preferences");
const verifyExport = await read("scripts/verify-export.mjs");
assert.ok(verifyExport.includes(".cache/blog-content.json") && verifyExport.includes("published article is missing") && verifyExport.includes("published article link is missing"), "post-build verification must compare the generated sitemap and RSS against every current published article");
assert.ok(verifyExport.includes("target has repeated slashes in its path") && verifyExport.includes("anchor"), "post-build verification must inspect internal anchor destinations and reject repeated slashes");
assert.ok(sitemap.includes("getBlogPosts()") && sitemap.includes("/blog/"), "sitemap must include published articles and blog archive");
assert.ok(sitemap.includes("/blog/contact/"), "sitemap must include the public contact page");
assert.ok(robots.includes('allow: ["/"]') && !/disallow:\s*\[[^\]]*\/admin\//.test(robots), "robots.txt must let crawlers read the admin pages' noindex directives");
assert.ok(!publicHeader.includes("/author/"), "no separate author archive should be generated");

assert.ok(markdownSource.includes("function esc(") && markdownSource.includes("function allowedUrl("), "Markdown rendering must escape HTML and validate links");
assert.ok(markdownSource.includes('new URL(candidate)') && markdownSource.includes('url.username') && markdownSource.includes('url.password'), "Markdown links must reject credential-bearing and unsupported URL schemes");
assert.ok(adminApp.includes('new URL(value)') && adminApp.includes('url.username') && adminApp.includes('url.password'), "CMS preview and clipboard URLs must use the same explicit safe-protocol checks");
assert.ok(markdownSource.includes('"http:","https:","mailto:"') && markdownSource.includes("new URL(candidate)"), "Markdown links must use an explicit safe URL allowlist");
assert.ok(markdownSource.includes("extractToc"), "Markdown headings must provide TOC data");

assert.ok(blogCss.includes("Estedad") && blogCss.includes("theme-white") && blogCss.includes("theme-warm"), "the public blog must use Estedad and the light theme variants");
assert.ok(blogCss.includes("body:has(.blog-theme) .analytics-consent") && blogCss.includes("body:has(.blog-theme) .analytics-preferences") && blogCss.includes("font-family: var(--font-estedad)"), "blog consent controls must use the light editorial palette and Estedad rather than the portfolio's dark chrome");
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
const lastMediaPreviewRule = [...adminCss.matchAll(/\.media-preview img\s*\{([^}]*)\}/g)].at(-1)?.[1] || "";
assert.ok(adminApp.includes("canvas.width=bitmap.width") && adminApp.includes("canvas.height=bitmap.height") && adminApp.includes("drawImage(bitmap,0,0,canvas.width,canvas.height)") && !adminApp.includes("const maxEdge=1800"), "CMS image optimization must compress without resizing or cropping the source");
assert.ok(lastMediaPreviewRule.includes("object-fit:contain"), "CMS image previews must preserve the original aspect ratio");
assert.ok(adminHtml.includes('name="username"') && adminHtml.includes('name="password"') && adminHtml.includes('autocomplete="on"'), "login form must expose recognizable username/password autocomplete semantics");
assert.ok(adminHtml.includes('id="insert-image"') && adminHtml.includes('id="inline-image-dialog"') && adminHtml.includes('id="inline-image-alt"') && adminHtml.includes('id="inline-image-title"') && adminHtml.includes('id="inline-image-caption"'), "CMS must provide inline image insertion with alt, title and caption fields");
assert.ok(adminApp.includes("function saveInlineImage") && adminApp.includes("placeInlineImageFigure") && adminApp.includes("image.alt=alt") && adminApp.includes("image.title=title"), "inline image editor must upload, place and update accessible image metadata");
const previewStart=adminApp.indexOf("function renderPreviewMarkdown");
const previewEnd=adminApp.indexOf("function inlineToMarkdown",previewStart);
const previewRenderer=adminApp.slice(previewStart,previewEnd);
assert.ok(previewRenderer.includes("for(let index=0;") && !previewRenderer.includes("return;") && previewRenderer.includes("continue;"), "full article preview must continue rendering after headings, blank lines, quotes and lists");
assert.ok(markdownSource.includes("parseImageLine") && markdownSource.includes("extractMarkdownImageUrls") && markdownSource.includes('class="blog-inline-image"') && markdownSource.includes("<figcaption>"), "public Markdown renderer must support semantic inline figures and expose them to article metadata");
assert.ok(copyLinkButton.includes("data-copy-link") && copyLinkButton.includes("data-copy-url") && blogCopyScript.includes("navigator.clipboard.writeText") && blogCopyScript.includes("لینک کپی شد"), "article copy-link button must delegate clipboard behavior and visible feedback to the standalone static script");
assert.ok(articlePage.includes("CopyLinkButton") && articlePage.includes("<CopyLinkButton url={canonical} />"), "article share section must render the copy-link control");
assert.ok(articlePage.includes("blog-article-header-grid") && articlePage.includes("blog-article-copy" ) && articlePage.includes("extractMarkdownImageUrls"), "article page must use a two-column editorial hero and include body images in article metadata");
const featuredImageRules = [...blogCss.matchAll(/\.blog-hero-image img\s*\{([^}]*)\}/g)].map((match)=>match[1]);
const desktopFeaturedImageRule = featuredImageRules.find((rule)=>rule.includes("object-fit:contain")) || "";
const mobileFeaturedImageRule = featuredImageRules.at(-1) || "";
assert.ok(desktopFeaturedImageRule.includes("height:auto") && desktopFeaturedImageRule.includes("max-height:none") && mobileFeaturedImageRule.includes("object-fit:cover") && mobileFeaturedImageRule.includes("min-height:250px"), "featured article images must preserve their full desktop dimensions and use a cover crop only in the mobile hero");
assert.ok(blogCss.includes(".blog-inline-image>img") && blogCss.includes(".blog-article-header-grid"), "public inline images and the editorial hero must have dedicated layouts");

assert.ok(adminApp.includes("previewInline"), "Markdown preview must use an escaped renderer");
assert.ok(!/localStorage|sessionStorage/.test(adminApp), "CMS session tokens must not be persisted in Web Storage");
assert.ok(adminApp.includes("PasswordCredential") && adminApp.includes("navigator.credentials.get") && adminApp.includes("preventSilentAccess"), "remember-me must rely on browser-managed credentials, not client-side token storage");
assert.ok(adminApp.includes("updateFormatToolbar") && adminApp.includes("getSelectedBlockquote") && adminApp.includes("unwrapBlockquote"), "format toolbar must reflect selection state and allow unwrapping blockquotes");
assert.ok(adminApp.includes("category_seo:collectCategorySeo") && adminApp.includes("renderCategorySeoEditor"), "CMS must edit and persist per-category SEO settings");
assert.ok(sitemap.includes("settings.sitemap_include_categories") && sitemap.includes("settings.category_seo?.[category.slug]") && sitemap.includes("settings.noindex_empty_categories"), "sitemap must respect global category inclusion and category robots settings");
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
const clipboardSanitizer = adminApp.slice(adminApp.indexOf("function cleanClipboardNode"), adminApp.indexOf("function sanitizeClipboardHtml"));
assert.ok(clipboardSanitizer.includes('(tag==="b"||tag==="strong")') && clipboardSanitizer.includes("normal|[1-5]00") && clipboardSanitizer.includes("return fragment;"), "clipboard sanitization must unwrap Google Docs neutral bold wrappers without removing nested emphasis");
const cardComponent = listingClient.slice(listingClient.indexOf("export function BlogPostCard"), listingClient.indexOf("export function BlogListingClient"));
assert.ok(cardComponent.includes('headingLevel = "h2"') && cardComponent.includes("const TitleHeading = headingLevel") && cardComponent.includes("<TitleHeading>"), "article card headings must support context-aware semantic levels");
assert.ok(listingClient.includes('headingLevel="h3"') && articlePage.includes('headingLevel="h3"'), "cards beneath archive and related-post H2 headings must use H3");
assert.ok(blogCss.includes(".blog-card-copy h2,.blog-card-copy h3") && blogCss.includes(".blog-card-featured .blog-card-copy h2,.blog-card-featured .blog-card-copy h3"), "article cards must retain identical styles for H2 and H3 titles");
assert.ok(adminApp.includes("editorToMarkdown") && adminApp.includes("refreshLinkManager"), "CMS must serialize rich text and expose per-link settings");
assert.ok(markdownSource.includes("rel=(follow|nofollow|sponsored|ugc)") && markdownSource.includes("target=(_blank|_self)") && markdownSource.includes('(external?"nofollow":"follow")'), "public Markdown renderer must preserve link relationship and target settings while defaulting external links to nofollow");
assert.ok(markdownSource.includes('class="blog-table-scroll"') && markdownSource.includes('class="blog-table"') && markdownSource.includes("<thead>") && markdownSource.includes("<tbody>") && markdownSource.includes("<u>"), "public Markdown renderer must emit an accessible, styled table wrapper with semantic table sections and underline support");

const markdownRuntime = { exports: {} };
const markdownCompiled = ts.transpileModule(markdownSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Script(markdownCompiled, { filename: "src/lib/blog-markdown.ts" }).runInNewContext({
  exports: markdownRuntime.exports,
  module: { exports: markdownRuntime.exports },
  URL,
  process: { env: { NEXT_PUBLIC_SITE_URL: "https://ariakianzad.github.io" } },
});
const normalizedAbsoluteCategoryLink = markdownRuntime.exports.renderMarkdown(
  "[دسته](https://ariakianzad.github.io//blog/category/brand-and-business/)",
);
assert.ok(
  normalizedAbsoluteCategoryLink.includes('href="https://ariakianzad.github.io/blog/category/brand-and-business/"') &&
    !normalizedAbsoluteCategoryLink.includes("ariakianzad.github.io//blog/"),
  "same-origin absolute Markdown links must collapse repeated path slashes",
);
const normalizedRelativeCategoryLink = markdownRuntime.exports.renderMarkdown(
  "[دسته](/blog//category/brand-and-business/)",
);
assert.ok(
  normalizedRelativeCategoryLink.includes('href="/blog/category/brand-and-business/"'),
  "same-origin relative Markdown links must collapse repeated path slashes",
);
const externalRepeatedPathLink = markdownRuntime.exports.renderMarkdown(
  "[external](https://example.com/a//b/)",
);
assert.ok(
  externalRepeatedPathLink.includes('href="https://example.com/a//b/"'),
  "URL normalization must not rewrite external paths",
);
const protocolRelativeLink = markdownRuntime.exports.renderMarkdown(
  "[external](//ariakianzad.github.io//blog/category/brand-and-business/)",
);
assert.ok(
  !protocolRelativeLink.includes('href="//ariakianzad.github.io') &&
    !protocolRelativeLink.includes('href="https://ariakianzad.github.io//'),
  "protocol-relative URLs must remain rejected",
);

const multiLineQuote = [
  "> تمام ادعاهای اصلی روایت رو در یک ستون بنویسید",
  "> در ستون کناری، مدرک عملی هرکدوم رو قرار بدید.",
  "> شاید باید ادعا رو دقیق‌تر کنید، شاید هم لازم باشه قبل از بازنویسی متن، بخشی از تجربۀ واقعی",
  "> [++کسب‌وکار++](https://ariakianzad.github.io/blog/category/brand-and-business/){rel=follow}",
  "> رو تغییر بدید.",
  "",
  "این پاراگراف باید بیرون از نقل‌قول باقی بمونه.",
].join("\n");
const renderedMultiLineQuote = markdownRuntime.exports.renderMarkdown(multiLineQuote);
assert.equal((renderedMultiLineQuote.match(/<blockquote>/g) || []).length, 1, "consecutive Markdown quote lines must render as one blockquote");
const renderedQuoteBlock = renderedMultiLineQuote.slice(
  renderedMultiLineQuote.indexOf("<blockquote>"),
  renderedMultiLineQuote.indexOf("</blockquote>") + "</blockquote>".length,
);
assert.equal((renderedQuoteBlock.match(/<p>/g) || []).length, 1, "consecutive quote lines without a blank quote marker must remain one paragraph");
assert.ok(
  renderedQuoteBlock.includes('<a href="https://ariakianzad.github.io/blog/category/brand-and-business/"') &&
    renderedQuoteBlock.indexOf("تجربۀ واقعی") < renderedQuoteBlock.indexOf("<a ") &&
    renderedQuoteBlock.indexOf("<a ") < renderedQuoteBlock.indexOf("رو تغییر بدید"),
  "an inline link split across quoted source lines must stay inside the same quotation paragraph",
);
assert.ok(
  renderedMultiLineQuote.includes("</blockquote>\n<p>این پاراگراف باید بیرون از نقل‌قول باقی بمونه.</p>"),
  "a paragraph following a blockquote must remain outside the quotation",
);
const multiParagraphQuote = markdownRuntime.exports.renderMarkdown([
  "> بند اول نقل‌قول",
  ">",
  "> بند دوم نقل‌قول",
].join("\n"));
assert.equal((multiParagraphQuote.match(/<blockquote>/g) || []).length, 1, "blank quoted lines must not split one blockquote into separate blocks");
assert.equal((multiParagraphQuote.match(/<p>/g) || []).length, 2, "blank quoted lines must preserve paragraph boundaries inside the blockquote");

// Execute the actual CMS preview renderer with minimal safe helpers.
const quotePreviewStart = adminApp.indexOf("function previewInline(text) {");
const quoteSerializerStart = adminApp.indexOf("function inlineToMarkdown(node) {", quotePreviewStart);
assert.ok(quotePreviewStart >= 0 && quoteSerializerStart > quotePreviewStart, "CMS preview renderer source must be discoverable for regression testing");
const quotePreviewSource = adminApp.slice(quotePreviewStart, quoteSerializerStart);
const quotePreviewContext = {
  escapeHtml: (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;",
  })[character]),
  safeHref: (value) => String(value || "#"),
  renderPreviewFigure: () => null,
};
new Script(quotePreviewSource + "\nthis.renderPreviewForTest=renderPreviewMarkdown;", { filename: "CMS blockquote preview" }).runInNewContext(quotePreviewContext);
const cmsPreviewQuote = quotePreviewContext.renderPreviewForTest(multiLineQuote);
assert.equal((cmsPreviewQuote.match(/<blockquote>/g) || []).length, 1, "the CMS live preview must group consecutive quote lines into one blockquote");
assert.ok(cmsPreviewQuote.includes('<a href="https://ariakianzad.github.io/blog/category/brand-and-business/"'), "the CMS preview must keep the inline link inside the grouped quote");

// Execute the actual editor serializer against a small DOM-shaped quotation node.
const quoteSerializerEnd = adminApp.indexOf("function editorToMarkdown(editor)", quoteSerializerStart);
assert.ok(quoteSerializerEnd > quoteSerializerStart, "CMS editor serializer source must be discoverable for regression testing");
const quoteSerializerSource = adminApp.slice(quoteSerializerStart, quoteSerializerEnd);
const quoteSerializerContext = { Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }, safeHref: (value) => String(value || "#") };
new Script(quoteSerializerSource + "\nthis.serializeBlockForTest=blockToMarkdown;", { filename: "CMS blockquote serializer" }).runInNewContext(quoteSerializerContext);
const textNode = (value) => ({ nodeType: 3, nodeValue: value });
const elementNode = (tag, children = [], attributes = {}, dataset = {}) => ({
  nodeType: 1, tagName: tag.toUpperCase(), childNodes: children, dataset,
  getAttribute(name) { return attributes[name] ?? null; },
});
const editorQuote = elementNode("blockquote", [
  elementNode("p", [
    textNode("تمام ادعاهای اصلی روایت رو در یک ستون بنویسید. "),
    elementNode("a", [
      elementNode("u", [textNode("کسب‌وکار")]),
    ], { href: "https://ariakianzad.github.io/blog/category/brand-and-business/", target: "_blank", rel: "noopener noreferrer" }, { linkRel: "follow", linkTarget: "_blank" }),
    textNode(" رو تغییر بدید."),
  ]),
]);
const serializedEditorQuote = quoteSerializerContext.serializeBlockForTest(editorQuote);
assert.ok(
  serializedEditorQuote.startsWith("> تمام ادعاهای اصلی روایت رو در یک ستون بنویسید. [++کسب‌وکار++](https://ariakianzad.github.io/blog/category/brand-and-business/)") &&
    serializedEditorQuote.includes(" رو تغییر بدید."),
  "the editor must serialize the quote and its linked phrase as one continuous Markdown blockquote",
);
const multiParagraphEditorQuote = elementNode("blockquote", [
  elementNode("p", [textNode("بند اول نقل‌قول")]),
  elementNode("p", [textNode("بند دوم نقل‌قول")]),
]);
const serializedMultiParagraphQuote = quoteSerializerContext.serializeBlockForTest(multiParagraphEditorQuote);
assert.ok(
  serializedMultiParagraphQuote.includes("> بند اول نقل‌قول\n>\n> بند دوم نقل‌قول"),
  "the editor must preserve paragraph breaks inside one Markdown blockquote using a blank quote marker",
);
assert.ok(markdownSource.includes("function plainInline(") && markdownSource.includes("title:plainInline(title)") && markdownSource.includes("line.match(/^(#{1,4})"), "TOC extraction must convert Markdown heading labels to plain text and keep heading ID counters aligned with rendered headings");
const tocMarkdown = [
  "# تیتر تکراری",
  "## **تیتر برجسته** با *تأکید* و \x60کد\x60",
  "### [**عنوان پیونددار**](https://example.com) و ~~خط‌خورده~~ و ++زیرخط++",
  "## تیتر تکراری",
].join("\n");
const extractedToc = markdownRuntime.exports.extractToc(tocMarkdown);
assert.equal(extractedToc.length, 3, "the TOC must include level-two and level-three headings only");
assert.equal(extractedToc[0].title, "تیتر برجسته با تأکید و کد", "TOC labels must remove bold, italic and inline-code Markdown markers");
assert.equal(extractedToc[1].title, "عنوان پیونددار و خط‌خورده و زیرخط", "TOC labels must keep link text while removing URLs and inline emphasis markers");
assert.equal(extractedToc[2].id, "تیتر-تکراری-2", "TOC heading IDs must account for earlier level-one headings just like the Markdown renderer");
const renderedTocHeadings = markdownRuntime.exports.renderMarkdown(tocMarkdown);
assert.ok(renderedTocHeadings.includes('<h2 id="' + extractedToc[2].id + '">تیتر تکراری</h2>'), "TOC anchor IDs must match the rendered article heading IDs");
assert.ok(articlePage.includes('<details className="blog-toc blog-toc-desktop">') && articlePage.includes('<details className="blog-toc-mobile">') && articlePage.includes("blog-toc-summary") && articlePage.includes("blog-toc-chevron") && articlePage.includes("blog-toc-index") && articlePage.includes("blog-toc-bullet") && articlePage.includes("sectionNumber += 1") && articlePage.includes('id="blog-toc-mobile-list"') && !articlePage.includes('<details className="blog-toc blog-toc-desktop" open'), "desktop and mobile TOCs must be native closed-by-default disclosures with shared summary controls and numbered H2/bulleted H3 entries");
assert.ok(blogCss.includes(".blog-toc-heading") && blogCss.includes(".blog-toc-bullet") && blogCss.includes(".blog-toc li.toc-sub .blog-toc-bullet") && blogCss.includes("max-height:min(52vh,460px)") && blogCss.includes("overflow-y:auto") && blogCss.includes("padding-inline:14px"), "the TOC must distinguish nested bullet markers and retain readable spacing and bounded scrolling on narrow screens");
assert.ok(blogCss.includes(".blog-toc-desktop > .blog-toc-summary") && blogCss.includes(".blog-toc-desktop[open] > .blog-toc-summary .blog-toc-chevron") && blogCss.includes("stroke-linecap:round") && blogCss.includes("blog-toc-mobile .blog-toc-chevron svg") && blogCss.includes("summary:focus-visible"), "desktop and mobile TOCs must use a custom vector chevron with a clear open state and keyboard focus treatment");

const sampleTable = [
  "| **نقش** | **تمرکز اصلی** |",
  "| --- | --- |",
  "| استراتژیست برند | تعیین جهت برند، جایگاه و تمایز |",
  "| طراح برند | تبدیل جهت استراتژیک به سیستم بصری |",
].join("\n");
const renderedTable = markdownRuntime.exports.renderMarkdown(sampleTable);
assert.ok(renderedTable.includes('<div class="blog-table-scroll" role="region" aria-label="جدول مقاله" tabindex="0">'), "Markdown tables must be wrapped in a keyboard-focusable responsive region");
assert.ok(renderedTable.includes('<table class="blog-table"><thead><tr><th><strong>نقش</strong></th><th><strong>تمرکز اصلی</strong></th></tr></thead>'), "Markdown table headers and inline emphasis must be rendered as semantic HTML");
assert.ok(renderedTable.includes("<tbody><tr><td>استراتژیست برند</td><td>تعیین جهت برند، جایگاه و تمایز</td></tr><tr><td>طراح برند</td><td>تبدیل جهت استراتژیک به سیستم بصری</td></tr></tbody>"), "Markdown table rows must be retained as separate cells in the right column order");
assert.ok(blogCss.includes(".blog-prose table.blog-table") && blogCss.includes("overflow-x:auto") && blogCss.includes("min-width:560px") && blogCss.includes("min-width:500px"), "article tables must have visible editorial styling and horizontal scrolling on narrow screens");

const publishedListMarkdown = [
  "- گزارش شناخت کسب‌وکار، مخاطب و فضای رقابتی؛",
  "",
  "- گزاره‌ی جایگاه‌یابی و ارزش پیشنهادی؛",
  "",
  "- چارچوب پیام، شخصیت و لحن برند؛",
  "",
  "- اصول راهنمای هویت بصری و کلامی؛",
].join("\n");
const renderedList = markdownRuntime.exports.renderMarkdown(publishedListMarkdown);
assert.equal((renderedList.match(/<ul>/g) || []).length, 1, "blank lines between Markdown bullets must not split one list into separate unordered lists");
assert.equal((renderedList.match(/<li>/g) || []).length, 4, "all blank-separated bullet items must remain inside one list");
const firstBullet = renderedList.indexOf("گزارش شناخت کسب‌وکار، مخاطب و فضای رقابتی؛");
const secondBullet = renderedList.indexOf("گزاره‌ی جایگاه‌یابی و ارزش پیشنهادی؛");
assert.ok(firstBullet >= 0 && secondBullet > firstBullet && renderedList.indexOf("</li>", firstBullet) < secondBullet, "the published article's blank-separated bullet text must remain in order as consecutive list items");

const nestedListMarkdown = [
  "- مورد اصلی",
  "  - زیرمورد اول",
  "  - زیرمورد دوم",
  "- مورد بعدی",
  "",
  "1. مرحلۀ اول",
  "",
  "2. مرحلۀ دوم",
].join("\n");
const renderedLists = markdownRuntime.exports.renderMarkdown(nestedListMarkdown);
const normalizedLists = renderedLists.replace(/\s+(?=<)/g,"");
assert.ok(normalizedLists.includes("<ul><li>مورد اصلی<ul><li>زیرمورد اول</li><li>زیرمورد دوم</li></ul></li><li>مورد بعدی</li></ul>"), "nested unordered lists must retain their hierarchy and close correctly: "+normalizedLists);
assert.ok(normalizedLists.includes("<ol><li>مرحلۀ اول</li><li>مرحلۀ دوم</li></ol>"), "blank-separated numbered items must remain in one ordered list");

const persianDigitList = markdownRuntime.exports.renderMarkdown([
  "۱. **مرحلۀ اول**",
  "   توضیح مرحلۀ اول.",
  "",
  "۲. **مرحلۀ دوم**",
  "   توضیح مرحلۀ دوم.",
].join("\n")).replace(/\s+(?=<)/g,"");
assert.equal((persianDigitList.match(/<ol>/g)||[]).length,1,"Persian-digit ordered markers must render as one ordered list");
assert.equal((persianDigitList.match(/<ul>/g)||[]).length,0,"Persian-digit ordered markers must never be downgraded to bullets");
assert.equal((persianDigitList.match(/<li>/g)||[]).length,2,"Persian-digit list items must remain separate");
assert.equal((persianDigitList.match(/<p>/g)||[]).length,2,"each Persian-digit item must keep its continuation paragraph");
const arabicIndicDigitList = markdownRuntime.exports.renderMarkdown([
  "١. **المرحلة الأولى**",
  "   وصف المرحلة الأولى.",
  "",
  "٢. **المرحلة الثانية**",
  "   وصف المرحلة الثانية.",
].join("\n")).replace(/\s+(?=<)/g,"");
assert.equal((arabicIndicDigitList.match(/<ol>/g)||[]).length,1,"Arabic-Indic ordered markers must render as one ordered list");
assert.equal((arabicIndicDigitList.match(/<ul>/g)||[]).length,0,"Arabic-Indic ordered markers must not be downgraded to bullets");

const numberedHeadingListMarkdown = [
  "1. ### مرحلۀ اول",
  "",
  "2. ### مرحلۀ دوم",
  "",
  "3. ### مرحلۀ سوم",
  "",
  "4. ### مرحلۀ چهارم",
].join("\n");
const renderedNumberedHeadingList = markdownRuntime.exports.renderMarkdown(numberedHeadingListMarkdown);
const normalizedNumberedHeadingList = renderedNumberedHeadingList.replace(/\s+(?=<)/g,"");
assert.equal((normalizedNumberedHeadingList.match(/<ol>/g)||[]).length,1,"numbered H3 items must remain in one ordered list so the browser can count 1 through 4");
assert.equal((normalizedNumberedHeadingList.match(/<li>/g)||[]).length,4,"all four numbered headings must remain list items");
assert.equal((normalizedNumberedHeadingList.match(/<h3 id=/g)||[]).length,4,"each numbered list item must retain its semantic H3 heading");
const numberedHeadingToc = markdownRuntime.exports.extractToc(numberedHeadingListMarkdown);
assert.equal(numberedHeadingToc.length,4,"numbered H3 list items must remain available to the article table of contents");
assert.equal(numberedHeadingToc[0].title,"مرحلۀ اول","the TOC must extract the title from a numbered heading item");
assert.ok(normalizedNumberedHeadingList.includes('<li><h3 id="'+numberedHeadingToc[0].id+'">مرحلۀ اول</h3></li>'),"numbered list heading IDs must match the table of contents");
const malformedHeadingListMarkdown = [
  "### **",
  "۱. یک مرجع روشن برای هویت برند بسازید**",
  "",
  "پاراگراف اول توضیح این مورد.",
  "",
  "### **",
  "۲. اطلاعات برند رو در منابع مختلف هماهنگ نگه دارید**",
  "",
  "پاراگراف دوم توضیح این مورد.",
  "",
  "### **",
  "۳. محتوا رو برای سؤال واقعی مخاطب طراحی کنید**",
  "",
  "پاراگراف سوم توضیح این مورد.",
  "",
  "### **",
  "۴. دسترسی فنی رو جداگانه بررسی کنید**",
  "",
  "پاراگراف چهارم توضیح این مورد.",
].join("\n");
const renderedMalformedHeadingList = markdownRuntime.exports.renderMarkdown(malformedHeadingListMarkdown);
const normalizedMalformedHeadingList = renderedMalformedHeadingList.replace(/\s+(?=<)/g,"");
assert.equal((normalizedMalformedHeadingList.match(/<ol/g)||[]).length,1,"split H3 title markers and Persian numerals must be repaired as one ordered list");
assert.equal((normalizedMalformedHeadingList.match(/<li>/g)||[]).length,4,"all four recovered heading items must stay in the same list");
assert.equal((normalizedMalformedHeadingList.match(/<h3 id=/g)||[]).length,4,"all four recovered headings must render as semantic H3 elements");
assert.equal((normalizedMalformedHeadingList.match(/<p>/g)||[]).length,4,"each recovered heading must retain its own explanatory paragraph inside the list item");
const malformedHeadingToc=markdownRuntime.exports.extractToc(malformedHeadingListMarkdown);
assert.equal(malformedHeadingToc.length,4,"recovered numbered H3 headings must appear in the table of contents");
assert.equal(malformedHeadingToc.map((item)=>item.title).join("\n"),[
  "یک مرجع روشن برای هویت برند بسازید",
  "اطلاعات برند رو در منابع مختلف هماهنگ نگه دارید",
  "محتوا رو برای سؤال واقعی مخاطب طراحی کنید",
  "دسترسی فنی رو جداگانه بررسی کنید",
].join("\n"),"the TOC must restore the original Persian numbered H3 titles without their numbering glyphs");

const continuedNumberedListMarkdown=[
  "1. **نرخ حضور:**",
  " برند در چه سهمی از پرسش‌های مرتبط ظاهر می‌شه؟",
  "",
  "2. **دقت اطلاعات:**",
  " چند مورد از ادعاهای قابل‌بررسی درباره‌ی برند درست هستن؟",
  "",
  "3. **کیفیت ارجاع:**",
  " آیا صفحه‌های رسمی و منابع معتبر به‌درستی به‌عنوان منبع معرفی می‌شن؟",
  "",
  "4. **اثر تجاری:**",
  " آیا این حضور به بازدید مرتبط یا اقدام معناداری منجر می‌شه؟",
].join("\n");
const renderedContinuedNumberedList=markdownRuntime.exports.renderMarkdown(continuedNumberedListMarkdown).replace(/\s+(?=<)/g,"");
assert.equal((renderedContinuedNumberedList.match(/<ol>/g)||[]).length,1,"one-space continuation paragraphs must not split numbered lists");
assert.equal((renderedContinuedNumberedList.match(/<li>/g)||[]).length,4,"continued numbered descriptions must stay in their original list items");
assert.equal((renderedContinuedNumberedList.match(/<p>/g)||[]).length,4,"each numbered metric must keep its explanatory paragraph");
assert.equal((renderedContinuedNumberedList.match(/<\/strong><p>/g)||[]).length,4,"each numbered metric must keep its explanatory paragraph directly after the bold label");


const continuedBulletListMarkdown=[
  "- **سطح اول، حضور:**",
  " آیا برند در پاسخ مرتبط ظاهر می‌شه؟ آیا نامش ذکر می‌شه؟",
  "",
  "- **سطح دوم، صحت بازنمایی:**",
  " آیا سیستم اطلاعات برند رو درست توضیح می‌ده؟",
  "",
  "- **سطح سوم، معنای حضور:**",
  " برند در چه موقعیتی وارد پاسخ شده؟",
].join("\n");
const renderedContinuedBulletList=markdownRuntime.exports.renderMarkdown(continuedBulletListMarkdown).replace(/\s+(?=<)/g,"");
assert.equal((renderedContinuedBulletList.match(/<ul>/g)||[]).length,1,"one-space continuation paragraphs must not split unordered lists");
assert.equal((renderedContinuedBulletList.match(/<li>/g)||[]).length,3,"bullet headings and descriptions must remain together in three list items");
assert.equal((renderedContinuedBulletList.match(/<p>/g)||[]).length,3,"each bullet item must keep its explanatory paragraph");

const formatMarkdown = [
  "## تیتر دوم",
  "### تیتر سوم",
  "#### تیتر چهارم",
  "",
  "پاراگراف با **متن برجسته**، *متن مورب*، ++زیرخط++، ~~متن خط‌خورده~~ و \x60کد درون‌خطی\x60 و [پیوند خارجی](https://example.com).",
  "",
  "> این یک نقل‌قول است.",
  "",
  "---",
  "",
  "\x60\x60\x60js",
  "const answer = 42;",
  "\x60\x60\x60",
  "",
  "![شرح تصویر](https://example.com/image.png \"عنوان تصویر\")",
].join("\n");
const renderedFormats = markdownRuntime.exports.renderMarkdown(formatMarkdown);
for (const [format, fragment] of [
  ["heading level 2","<h2"],
  ["heading level 3","<h3"],
  ["heading level 4","<h4"],
  ["paragraph","<p>"],
  ["bold","<strong>متن برجسته</strong>"],
  ["italic","<em>متن مورب</em>"],
  ["underline","<u>زیرخط</u>"],
  ["strikethrough","<del>متن خط‌خورده</del>"],
  ["inline code","<code>کد درون‌خطی</code>"],
  ["external link","href=\"https://example.com\""],
  ["blockquote","<blockquote><p>این یک نقل‌قول است.</p></blockquote>"],
  ["horizontal rule","<hr>"],
  ["fenced code","<pre><code class=\"language-js\">const answer = 42;</code></pre>"],
  ["inline image","<figure class=\"blog-inline-image\"><img"],
]) assert.ok(renderedFormats.includes(fragment), format + " must render to semantic HTML");

const underscoredUrl = "https://en.wikipedia.org/wiki/Brand_positioning?utm_source=weekly_newsletter";
const renderedUnderscoredLink = markdownRuntime.exports.renderMarkdown("[**مقالۀ مرتبط**](" + underscoredUrl + ")");
assert.ok(renderedUnderscoredLink.includes('href="' + underscoredUrl + '"'), "underscores in external URLs and query parameters must remain unchanged");
assert.ok(renderedUnderscoredLink.includes('target="_blank"') && renderedUnderscoredLink.includes('rel="nofollow noopener noreferrer"'), "protected link tags must retain safe external-link attributes");
assert.ok(renderedUnderscoredLink.includes("<strong>مقالۀ مرتبط</strong>"), "inline formatting inside a link label must still render");
const renderedEmptyLabelLink = markdownRuntime.exports.renderMarkdown("[ ](https://www.justice.gov/usao-ndca/example){rel=follow}هولمز");
assert.ok(renderedEmptyLabelLink.includes(">مشاهده منبع</a> هولمز"), "empty Markdown link labels must render as accessible visible text with spacing around the link");
const renderedUnderscoredImage = markdownRuntime.exports.renderMarkdown('![my_image_alt](https://example.com/my_image_file.png "my_image_title")');
assert.ok(renderedUnderscoredImage.includes('src="https://example.com/my_image_file.png"') && renderedUnderscoredImage.includes('alt="my_image_alt"') && renderedUnderscoredImage.includes('title="my_image_title"'), "underscores in image URLs, alt text and titles must be preserved");

const listSerializerSource = adminApp.slice(adminApp.indexOf("function inlineToMarkdown"),adminApp.indexOf("function blockToMarkdown"));
const listSerializerContext = {Node:{TEXT_NODE:3,ELEMENT_NODE:1},safeHref:(value)=>value};
new Script(listSerializerSource+"\nthis.testListToMarkdown=listToMarkdown;",{filename:"admin-list-serializer.js"}).runInNewContext(listSerializerContext);
const makeTextNode=(value)=>({nodeType:3,nodeValue:value});
const makeHeadingNode=(value)=>({nodeType:1,tagName:"H3",childNodes:[{nodeType:1,tagName:"STRONG",childNodes:[makeTextNode(value)]}]});
const makeParagraphNode=(value)=>({nodeType:1,tagName:"P",childNodes:[makeTextNode(value)]});
const makeListItem=(heading,paragraph)=>({nodeType:1,tagName:"LI",childNodes:[heading,paragraph],getAttribute:()=>null});
const numberedHeadingDom={tagName:"OL",children:[makeListItem(makeHeadingNode("مرحلۀ اول"),makeParagraphNode("توضیح اول")),makeListItem(makeHeadingNode("مرحلۀ دوم"),makeParagraphNode("توضیح دوم"))],getAttribute:()=>null};
assert.equal(listSerializerContext.testListToMarkdown(numberedHeadingDom,0),"1. ### **مرحلۀ اول**\n  توضیح اول\n\n2. ### **مرحلۀ دوم**\n  توضیح دوم","the editor serializer must retain heading style, bold text, sequential numbering and continued paragraphs when saving list items");
assert.ok(adminApp.includes("function selectedEditorListItems()") && adminApp.includes("function formatListItemHeading") && adminApp.includes('command==="formatBlock"&&/^H[234]$/.test(value||"")') && adminApp.includes('$("#preview-content").dir=direction'),"applying H2-H4 to selected list items must preserve their surrounding UL/OL structure and previews must follow the article language direction");
const inlineSerializer = adminApp.slice(adminApp.indexOf("function inlineToMarkdown"),adminApp.indexOf("function listToMarkdown"));
const blockSerializer = adminApp.slice(adminApp.indexOf("function blockToMarkdown"),adminApp.indexOf("function editorToMarkdown"));
assert.ok(blockSerializer.includes('const blockTags=new Set(["DIV","SECTION","H2","H3","H4","UL","OL","BLOCKQUOTE","TABLE","PRE","HR","FIGURE"])') &&
  blockSerializer.includes("?blockToMarkdown(child)") && blockSerializer.includes('if(tag==="p")'),
  "paragraph wrappers containing a block list must serialize the list structurally rather than flattening its markers");

const blockListSerializerContext={Node:{TEXT_NODE:3,ELEMENT_NODE:1},safeHref:(value)=>String(value||"#")};
new Script(listSerializerSource+"\n"+blockSerializer+"\nthis.testBlockToMarkdown=blockToMarkdown;",{filename:"admin-list-roundtrip.js"}).runInNewContext(blockListSerializerContext);
const makeSerializerNode=(tag,children=[],attributes={})=>({
  nodeType:1,tagName:tag.toUpperCase(),childNodes:children,
  children:children.filter((child)=>child.nodeType===1),
  getAttribute(name){return attributes[name]??null;},
  querySelector(){return null;},
});
const makeSerializerText=(value)=>({nodeType:3,nodeValue:value});
const wrappedOrderedList=makeSerializerNode("p",[
  makeSerializerNode("ol",[
    makeSerializerNode("li",[
      makeSerializerNode("p",[makeSerializerNode("strong",[makeSerializerText("نکتۀ اول")])]),
      makeSerializerNode("p",[makeSerializerText("توضیح اول")]),
    ]),
    makeSerializerNode("li",[
      makeSerializerNode("p",[makeSerializerNode("strong",[makeSerializerText("نکتۀ دوم")])]),
      makeSerializerNode("p",[makeSerializerText("توضیح دوم")]),
    ]),
  ]),
]);
const serializedWrappedOrderedList=blockListSerializerContext.testBlockToMarkdown(wrappedOrderedList);
assert.ok(
  serializedWrappedOrderedList.includes("1. **نکتۀ اول**") &&
    serializedWrappedOrderedList.includes("2. **نکتۀ دوم**") &&
    serializedWrappedOrderedList.includes("توضیح اول") &&
    serializedWrappedOrderedList.includes("توضیح دوم"),
  "the full editor serializer must preserve ordered-list markers and each item's paragraphs when the browser nests OL inside P",
);


assert.ok(["tag===\"strong\"","tag===\"em\"","tag===\"u\"","tag===\"del\"","tag===\"code\"","tag===\"a\"","tag===\"img\""].every((token)=>inlineSerializer.includes(token)), "the editor serializer must preserve emphasis, underline, deletion, code, links and images");
assert.ok(["tag===\"figure\"","/^h[1-6]$/","tag===\"p\"","tag===\"ul\"","tag===\"ol\"","tag===\"blockquote\"","tag===\"pre\"","tag===\"hr\"","tag===\"table\""].every((token)=>blockSerializer.includes(token)), "the editor serializer must preserve all supported block structures");
const cmsInlineSource = adminApp.slice(adminApp.indexOf("function previewInline"),adminApp.indexOf("function renderPreviewMarkdown"));
const cmsInlineContext = {
  escapeHtml:(value)=>String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char])),
  safeHref:(value)=>String(value||"#"),
};
new Script(cmsInlineSource+"\nthis.testPreviewInline=previewInline;",{filename:"admin-inline-preview.js"}).runInNewContext(cmsInlineContext);
const renderedCmsEmptyLabel = cmsInlineContext.testPreviewInline("[ ](https://www.justice.gov/usao-ndca/example){rel=follow}هولمز");
assert.ok(renderedCmsEmptyLabel.includes(">مشاهده منبع</a> هولمز"), "the CMS editing preview must replace empty link labels with accessible visible text");
const cmsPreviewRenderer = adminApp.slice(adminApp.indexOf("function renderPreviewMarkdown"),adminApp.indexOf("function inlineToMarkdown"));
assert.ok(cmsPreviewRenderer.includes("const parseListItem=") && cmsPreviewRenderer.includes("listStack") && cmsPreviewRenderer.includes("if(!parseListItem(") && cmsPreviewRenderer.includes("appendListItem(item)"), "the CMS preview must preserve blank-separated and nested list structure");
const cmsPreviewContext = {
  escapeHtml:(value)=>String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char])),
  previewInline:(value)=>String(value),
  renderPreviewFigure:()=>"",
};
new Script(cmsPreviewRenderer+"\nthis.testRenderPreviewMarkdown=renderPreviewMarkdown;",{filename:"admin-list-preview.js"}).runInNewContext(cmsPreviewContext);
const renderedCmsNumberedHeadings = cmsPreviewContext.testRenderPreviewMarkdown(numberedHeadingListMarkdown).replace(/\s+(?=<)/g,"");
assert.equal((renderedCmsNumberedHeadings.match(/<ol>/g)||[]).length,1,"the admin preview must keep all numbered headings in one OL");
assert.equal((renderedCmsNumberedHeadings.match(/<li>/g)||[]).length,4,"the admin preview must keep all four list items");
assert.equal((renderedCmsNumberedHeadings.match(/<h3>/g)||[]).length,4,"the admin preview must show H3 semantics inside each numbered list item");
const renderedCmsPersianList=cmsPreviewContext.testRenderPreviewMarkdown([
  "۱. **مرحلۀ اول**",
  "   توضیح مرحلۀ اول.",
  "",
  "۲. **مرحلۀ دوم**",
  "   توضیح مرحلۀ دوم.",
].join("\n")).replace(/\s+(?=<)/g,"");
assert.equal((renderedCmsPersianList.match(/<ol>/g)||[]).length,1,"CMS preview must treat Persian-digit markers as an ordered list");
assert.equal((renderedCmsPersianList.match(/<ul>/g)||[]).length,0,"CMS preview must not convert Persian-digit ordered lists into bullets");
assert.equal((renderedCmsPersianList.match(/<li>/g)||[]).length,2,"CMS preview must preserve each Persian-digit list item");

const renderedCmsMalformedHeadings=cmsPreviewContext.testRenderPreviewMarkdown(malformedHeadingListMarkdown).replace(/\s+(?=<)/g,"");
assert.equal((renderedCmsMalformedHeadings.match(/<ol>/g)||[]).length,1,"the admin editor must repair legacy split heading markers into one ordered list");
assert.equal((renderedCmsMalformedHeadings.match(/<h3>/g)||[]).length,4,"the admin editor must reconstruct all four H3 heading styles");
assert.equal((renderedCmsMalformedHeadings.match(/<p>/g)||[]).length,4,"the admin editor must keep each heading item's explanatory paragraph");
const renderedCmsContinuedList=cmsPreviewContext.testRenderPreviewMarkdown(continuedNumberedListMarkdown).replace(/\s+(?=<)/g,"");
assert.equal((renderedCmsContinuedList.match(/<ol>/g)||[]).length,1,"the admin editor must keep one-space continuation paragraphs inside a single ordered list");
assert.equal((renderedCmsContinuedList.match(/<li>/g)||[]).length,4,"the admin editor must keep each metric label and its description in one list item");

assert.ok(blogCss.includes(".blog-prose ul{list-style-type:disc}") && blogCss.includes('.blog-article-main[dir="rtl"] .blog-prose ol{list-style-type:persian}') && blogCss.includes('.blog-article-main[dir="ltr"] .blog-prose ol{list-style-type:decimal}') && blogCss.includes('.blog-article-main[dir="rtl"] .blog-prose ol ol,.blog-article-main[dir="ltr"] .blog-prose ol ol{list-style-type:lower-alpha}') && blogCss.includes('.blog-article-main[dir="rtl"] .blog-prose ol ol ol,.blog-article-main[dir="ltr"] .blog-prose ol ol ol{list-style-type:lower-roman}') && blogCss.includes(".blog-prose li::marker"), "public article lists must use direction-aware top-level numbering while preserving alphabetic and Roman nested levels");
assert.ok(["h2","h3","h4","p","strong","em","u","del","a","blockquote","pre","code","img","hr"].every((tag)=>blogCss.includes(".blog-prose "+tag)), "public article CSS must style every semantic text format emitted by the Markdown renderer");
assert.ok(blogCss.includes(".blog-theme .blog-related .blog-card-copy{padding:26px 28px 22px}") && blogCss.includes("padding-block:72px clamp(48px,6vw,88px)"), "related article cards must keep internal breathing room and remain separated from the footer");
assert.ok(adminCss.includes(".editor-richtext strong") && adminCss.includes(".editor-richtext em") && adminCss.includes(".editor-richtext u") && adminCss.includes(".editor-richtext del") && adminCss.includes(".editor-richtext ul { list-style:disc; }") && adminCss.includes('.editor-richtext[dir="rtl"] ol { list-style-type:persian; }') && adminCss.includes('.editor-richtext[dir="ltr"] ol { list-style-type:decimal; }') && adminCss.includes('.markdown-preview article[dir="rtl"] ol { list-style-type:persian; }') && adminCss.includes('.markdown-preview article[dir="ltr"] ol { list-style-type:decimal; }') && adminCss.includes('.editor-richtext[dir="rtl"] ol ol,.editor-richtext[dir="ltr"] ol ol') && adminCss.includes('.markdown-preview article[dir="rtl"] ol ol,.markdown-preview article[dir="ltr"] ol ol'), "the CMS editing surface and live Markdown preview must both style inline formats and use Persian ordered-list markers");

assert.ok(siteChrome.includes("usePathname") && siteChrome.includes("isBlog"), "blog routes must not inherit the portfolio chrome");
assert.ok(listingPage.includes('settings.tagline || "یادداشت‌هایی درباره برند، معنا و ارتباط"'), "blog archive H1 must use the descriptive tagline");
assert.ok(listingPage.includes('import HeroVisual from "@/components/hero-visual"') && listingPage.includes("<HeroVisual />"), "blog archive must reuse the homepage signal animation");
assert.ok(!listingPage.includes("یادداشت‌ها و مقاله‌ها") && !listingPage.includes("ایده‌ها، تحقیق و نگاه شخصی") && !listingPage.includes("آرشیو نوشته‌ها"), "blog archive must remove the three redundant microcopy labels");
assert.ok(listingPage.includes("blog-intro-copy") && listingPage.includes("blog-intro-visual"), "blog intro must separate its title from the animation area");
assert.ok(heroVisualComponent.includes("data-hero-visual") && signalScene.includes('new THREE.Color("#782C44")') && !signalScene.includes('getPropertyValue("--blog-accent")'), "shared hero scene must use the homepage palette consistently on the blog");
assert.ok(heroBootstrap.includes("MutationObserver") && heroBootstrap.includes("syncRoots"), "hero scene must initialize after client-side route changes");
assert.ok(publicHeader.includes("<span>آریا کیانزاد</span>"), "blog header brand must show the author's name");
assert.ok(publicHeader.includes('src="/brand-logo.png?v=20261128-1"') &&
  publicHeader.includes('className="blog-brand-mark"') &&
  !publicHeader.includes("<text") &&
  publicHeader.includes('<span>آریا کیانزاد</span>'),
  "the blog header must use the original logo image rather than an SVG text monogram");
assert.ok(blogCss.includes(".blog-theme .blog-header-blog-link {") && blogCss.includes('grid-template-areas:"visual copy"') && blogCss.includes("position:absolute;"), "blog header and hero must retain their desktop/mobile layout contracts");
assert.ok(listingPage.includes("blog-intro-description") && listingPage.includes("settings.description"), "blog homepage must show the configured homepage description separately from its SEO description");
assert.ok(blogCss.includes(".blog-theme .blog-intro > .blog-intro-description") && blogCss.includes("grid-column:1 / -1") && blogCss.includes("max-width:none"), "homepage description must have a full-width responsive row on mobile and desktop");
assert.ok(blogLayout.includes('url: "/favicon.svg?v=20261128-1"') && blogLayout.includes('themeColor: "#FBFBF7"'), "blog must use the shared favicon and current browser theme colour");
assert.ok(blogLayout.includes('lang={language}') && blogLayout.includes('dir={direction}'), "the blog shell must declare its active language and direction for all nested content");
assert.ok(publicHeader.includes('className="blog-skip-link" href="#main"') && blogChromeCss.includes(".blog-skip-link:focus-visible"), "blog header must provide keyboard-visible skip navigation");
assert.ok((listingPage.match(/<main id="main"/g)||[]).length===1 && (articlePage.match(/<main id="main"/g)||[]).length===2 && (categoryPage.match(/<main id="main"/g)||[]).length===2 && contactPage.includes('<main id="main"') && blogNotFound.includes('<main id="main"') && notFoundContent.includes('<main id="main"'), "all public blog routes and blog 404 states must provide a main landmark target");
assert.ok(listingPage.includes('id="main" tabIndex={-1}') && articlePage.includes('id="main" tabIndex={-1}') && categoryPage.includes('id="main" tabIndex={-1}') && contactPage.includes('id="main" tabIndex={-1}') && blogNotFound.includes('id="main" tabIndex={-1}') && notFoundContent.includes('id="main" tabIndex={-1}'), "blog skip-link targets must be programmatically focusable");
assert.ok(listingClient.includes('role="group" aria-label="دسته‌بندی‌ها"'), "category filter controls must expose an accessible group name");
assert.ok(rootLayout.includes('role="region"') && !rootLayout.includes('role="dialog"'), "the non-modal analytics preferences panel must not claim modal dialog semantics");
assert.ok(contactPage.includes("BlogHeader") && contactPage.includes("BlogFooter") && contactPage.includes("ContactForm"), "contact page must use the blog editorial shell");
assert.ok(contactPage.includes('title: "تماس با من | درخواست همکاری و اسپانسری"') && contactPage.includes("<h3>رپورتاژ و محتوای تبلیغاتی</h3>") && contactPage.includes("<h3>اسپانسری دوره‌ای و بنرهای تبلیغاتی</h3>") && contactPage.includes("<h3>همکاری و پیشنهادهای دیگر</h3>"), "contact page must use the revised title and H3 hierarchy");
assert.ok(contactForm.includes("data-blog-contact-form") && contactForm.includes("noValidate") && contactForm.includes("advertorial") && contactForm.includes("sponsorship") && !contactForm.includes("editorial_link") && !contactForm.includes("بررسی ارجاع تحریریه‌ای") && !contactForm.includes('"use client"'), "contact form must omit the editorial-link request option and remain static HTML");
assert.ok(contactForm.includes('data-show-for="advertorial sponsorship"') && contactForm.includes('data-show-for="sponsorship" hidden') && contactForm.includes('name="sponsorshipDuration"'), "sponsorship duration must exist only in the sponsorship conditional field");
assert.ok(blogCss.includes(".blog-contact-field[hidden] {") && /\.blog-contact-field\[hidden\]\s*\{\s*display:\s*none\s*!important;/.test(blogCss), "hidden conditional contact fields must not be overridden by display:grid");
assert.ok(contactBrowserScript.includes('container.hidden = !shouldShow') && contactBrowserScript.includes('field.disabled = !shouldShow'), "contact form must hide and disable fields outside their selected request type");
assert.ok(contactBrowserScript.includes("functions/v1/blog-contact") && contactBrowserScript.includes("addEventListener(\"submit\"") && contactBrowserScript.includes("form.checkValidity()") && contactBrowserScript.includes("data-contact-status"), "same-origin browser script must handle submission, validation and visible feedback");
assert.ok(contactPage.includes('<script src="/blog-contact.js" defer />'), "contact behavior must be loaded only on the contact route as a first-party script allowed by the CSP");
assert.ok(contactBrowserScript.includes("sb_publishable_") && contactBrowserScript.includes("crypto.randomUUID"), "contact browser script must include the public Supabase key and unique submission id");
assert.ok(!contactForm.includes("targetUrl") && !contactForm.includes("anchorText") && !contactForm.includes("contact-target") && !contactForm.includes("contact-anchor"), "contact form must not ask for destination URLs or anchor text");
assert.ok(!contactForm.includes("developers.google.com/search/docs/essentials/spam-policies") && !contactForm.includes("لینک Follow در ازای پرداخت ارائه نمی‌شه"), "contact form must not show the paid-link policy paragraph");
assert.ok(contactEdge.includes('editorial_link: "بررسی ارجاع تحریریه‌ای Follow بدون پرداخت بابت لینک"'), "contact endpoint must distinguish unpaid editorial link requests from paid advertorials");
assert.ok(contactEdge.includes('request.headers.get("cf-connecting-ip")') && !contactEdge.includes('"x-real-ip"') && !contactEdge.includes('"x-forwarded-for"'), "contact rate limiting must not trust caller-controlled forwarding-header fallbacks");
assert.ok(contactEdge.includes("const rateLimitIdentities = [") && contactEdge.includes('"email:" + email') && contactEdge.includes('"ip:" + address'), "contact rate limiting must fall back to a keyed email identity when Cloudflare does not provide a client IP, without using a shared unknown bucket");
assert.ok(contactEdge.includes('field(body, "message", 3000, true, false)') && contactEdge.includes("u001F") && contactEdge.includes("u009F"), "single-line fields must strip all control characters while the message retains line breaks");
assert.ok(contactEdge.includes('readSecret("CLOUDFLARE_TURNSTILE_ENABLED") === "true"') && contactEdge.includes("CLOUDFLARE_TURNSTILE_SECRET_KEY") && contactEdge.includes("/turnstile/v0/siteverify") && contactEdge.includes('result.action === "blog_contact"') && contactEdge.includes('result.hostname === new URL(SITE_ORIGIN).hostname'), "Turnstile must be explicitly enabled and validated server-side against the expected hostname and action");
assert.ok(contactForm.includes("NEXT_PUBLIC_TURNSTILE_SITE_KEY") && contactForm.includes('data-action="blog_contact"') && contactBrowserScript.includes("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"), "the public contact form must render Turnstile only when its site key is configured and load the widget through its browser controller");
assert.ok(contactBrowserScript.includes("cf-turnstile-response") && contactBrowserScript.includes("window.turnstile.reset"), "the browser must require a widget token when Turnstile is enabled and reset it after attempts");
assert.ok(contactEdge.includes('name: "HMAC"') && contactEdge.includes('hash: "SHA-256"'), "contact rate-limit fingerprints must use keyed HMAC-SHA-256");
assert.ok(contactEdge.includes("GOOGLE_APPS_SCRIPT_URL") && contactEdge.includes("GOOGLE_APPS_SCRIPT_TOKEN") && !contactEdge.includes("RESEND_API_KEY"), "contact Edge Function must route email delivery through the private Google Apps Script endpoint");
assert.ok(googleContactScript.includes("MailApp.sendEmail") && googleContactScript.includes("BLOG_CONTACT_TOKEN") && googleContactScript.includes("BLOG_CONTACT_TO_EMAIL") && googleContactScript.includes("CacheService"), "Google Apps Script mail sender must protect its endpoint, use the owner's Gmail and deduplicate submissions");
assert.ok(contactEdge.includes("consume_blog_contact_rate_limit") && contactEdge.includes("companyFax") && contactEdge.includes("SITE_ORIGIN"), "contact endpoint must enforce origin, honeypot and rate limits");
assert.ok(contactMigration.includes("private.blog_contact_rate_limits") && contactMigration.includes("SECURITY DEFINER") && contactMigration.includes("GRANT EXECUTE ON FUNCTION public.consume_blog_contact_rate_limit"), "contact rate limiting must use a private database function");
assert.ok(signalScene.includes("new THREE.IcosahedronGeometry(0.92, 5)") && signalScene.includes("new THREE.IcosahedronGeometry(0.51, 2)") && signalScene.includes('window.matchMedia("(max-width: 700px)").matches ? 2.72 : 2.35') && signalScene.includes("visibleHalfHeight / Math.tan") && !signalScene.includes("new THREE.SphereGeometry(0.92"), "shared homepage hero geometry must keep the orbit system inside the blog canvas at responsive sizes");
assert.ok(signalScene.includes("new THREE.MeshPhysicalMaterial({") && signalScene.includes("new THREE.MeshStandardMaterial({") && signalScene.includes("innerGeometry.dispose()") && signalScene.includes("renderer.dispose()"), "shared homepage hero meshes and WebGL resources must be disposed cleanly");
assert.ok(rootLayout.includes("https://bkohdqwecnvbmeaiuyyx.supabase.co;") && !rootLayout.includes("'unsafe-inline'"), "site CSP must allow contact form requests without permitting inline scripts");
assert.ok(blogLayout.includes("<style>{themeStyles}</style>") && !blogLayout.includes("style={") &&
  articlePage.includes("<style>{articleStyles}</style>") && !articlePage.includes("style={"),
  "dynamic blog theme values must use hashed style blocks instead of inline style attributes");
assert.ok(articlePage.includes("Number.isFinite(configuredLineHeight)") &&
  articlePage.includes("Math.min(2.4, Math.max(1.6, configuredLineHeight))") &&
  articlePage.includes("--post-accent:var(--blog-accent)"),
  "article CSS variables must be bounded and colour values validated before rendering");
assert.ok(rootLayout.includes("https://challenges.cloudflare.com") && staticHostHeaders.includes("https://challenges.cloudflare.com") && apacheHeaders.includes("https://challenges.cloudflare.com"), "the page and compatible static-host CSPs must allow Turnstile scripts and frames");
assert.ok(configToml.includes("[functions.blog-contact]") && configToml.includes("verify_jwt = false"), "contact Edge Function must have public JWT configuration");
assert.ok(!articlePage.includes("ARTICLE / ARCHIVE") && !categoryPage.includes("CATEGORY / ARCHIVE"), "public blog screens must not expose English archive labels");
assert.ok(!adminHtml.includes("Google Docs") && !adminHtml.includes("Open Graph") && !adminHtml.includes(">English<"), "CMS visible interface copy must be Persian");
assert.ok(blogCss.includes("body:has(.blog-theme)") && blogCss.includes("font-family:var(--font-estedad)"), "blog pages must keep their own shell and Estedad typography");
assert.ok(blogCss.includes('grid-template-areas:"visual copy"') && blogCss.includes("grid-template-columns:minmax(0,.86fr) minmax(0,1.14fr)") && blogCss.includes("aspect-ratio:1 / 1") && blogCss.includes("overflow:visible") && blogCss.includes("font-size:clamp(24px,7.2vw,33px)"), "mobile blog hero must keep the animation beside a compact title without cropping or overlap");
assert.ok(blogCss.includes("max-width:410px") && blogCss.includes("height:clamp(260px,28vw,340px)") && blogCss.includes("max-width:220px"), "desktop and mobile blog hero visual sizes must stay within compact bounds");
assert.ok(blogCss.includes(`grid-template-areas:"hero" "meta"`) && blogCss.includes("background:rgba(255, 255, 255,.82)") && blogCss.includes("filter:brightness(.83) saturate(.9)") && blogCss.includes(".blog-article-meta {\n    grid-area:meta;\n    direction:rtl;"), "mobile article cover must keep the title readable without obscuring the featured image");
assert.ok(blogCss.includes("direction:rtl; text-align:right") && blogCss.includes(".blog-socials"), "blog footer must use RTL alignment and social icon links");
assert.ok(/@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*?\.blog-footer-side\s*\{[^}]*width:\s*100%;[^}]*justify-items:\s*stretch;[\s\S]*?\.blog-footer-links,\s*\.blog-socials\s*\{[^}]*width:\s*100%;[^}]*justify-content:\s*center;/m.test(blogCss), "mobile blog footer navigation and social rows must be horizontally centered across the available viewport width");
assert.ok(articlePage.indexOf("<h1>{post.title}</h1>") < articlePage.indexOf("<figure className=\"blog-hero-image\">"), "featured image must follow the article title");
assert.ok(publicHeader.includes("SocialIcon") && !publicHeader.includes("mailto:") && !publicHeader.includes("/#about"), "blog footer must remove email/about links and include social icons");

assert.ok(adminHtml.includes("مرا به خاطر بسپار") && !/EDITORIAL OVERVIEW|RECENT WORK|CONTENT LIBRARY|PRIVATE WORKSPACE|MAIN WEBSITE/.test(adminHtml), "CMS visible labels must be Persian and offer a remember-me option");
assert.ok(categoryTaxonomyMigration.includes("add column if not exists categories jsonb") && categoryTaxonomyMigration.includes("'brand-and-business'") && categoryTaxonomyMigration.includes("blog_get_public_blog_settings_extras"), "taxonomy migration must seed a stable English category slug and expose only curated public settings");
assert.ok(cultureRenameMigration.includes("category.item ->> 'slug' = 'culture'") && cultureRenameMigration.includes("'فرهنگ و رسانه'::text") && !cultureRenameMigration.includes("set slug"), "culture display name migration must preserve the stable culture URL slug");
assert.ok(adminHtml.includes('id="post-category-options"') && adminHtml.includes('id="post-primary-category"') && adminHtml.includes('id="category-manager-list"') && adminHtml.includes('id="new-category-name"') && adminHtml.includes('id="new-category-slug"'), "CMS must expose managed categories with Persian labels and independent English slugs");
assert.ok(adminApp.includes("function getConfiguredCategories") && adminApp.includes("function addManagedCategory") && adminApp.includes("collectCategories(settings?.categories||[])") && adminApp.includes("renderCategoryManager(settings)"), "CMS must add, list, preserve and select managed categories");
assert.ok(adminApp.includes("function syncCategoryDrafts()") && adminApp.includes("categories:collectCategories(current.categories||[])") && adminApp.includes("category_seo:collectCategorySeo(current.category_seo||{})"), "the CMS must synchronize category names and category SEO into shared draft state before a rerender");
const categoryAddSource = adminApp.slice(adminApp.indexOf("function addManagedCategory()"), adminApp.indexOf("function categorySeoEntries()"));
const categoryRemoveSource = adminApp.slice(adminApp.indexOf("function renderCategoryManager(settings)"), adminApp.indexOf("function addManagedCategory()"));
assert.ok(categoryAddSource.indexOf("syncCategoryDrafts();") < categoryAddSource.indexOf("getConfiguredCategories(state.settings)") && categoryRemoveSource.indexOf("syncCategoryDrafts();") < categoryRemoveSource.indexOf("const next=(state.settings?.categories||[])"), "adding or removing a category must first preserve other unsaved category and SEO edits");
assert.ok(adminApp.includes('$("#category-seo-list").addEventListener("input",syncCategoryDrafts)') && adminApp.includes('$("#category-seo-list").addEventListener("change",syncCategoryDrafts)'), "category SEO text and checkbox edits must persist in draft state as the user changes them");
assert.ok(adminHtml.includes("عنوان اصلی (H1)") && adminHtml.includes("جای H1 قابل‌مشاهده رو نمی‌گیرن") && adminHtml.includes("توضیح نمایشی دسته‌بندی"), "the category manager must explain the difference between its visible display name, visible description and head SEO metadata");
assert.ok(categoryPage.includes("<h1>{item.name}</h1>") && categoryPage.includes("{seo?.description ? <p className=\"blog-category-description\">{seo.description}</p> : null}") && categoryPage.includes("const title = seo?.seo_title || item.name"), "category display name controls the visible H1, description controls visible body copy, and SEO title controls document metadata");
assert.ok(adminEdge.includes("function categoriesValue") && adminEdge.includes("^[a-z0-9]+(?:-[a-z0-9]+)*$") && adminEdge.includes("post.categories.filter((slug) => !available.some((item: Record<string, unknown>) => item.slug === slug))"), "Edge Function must validate English category slugs and reject unknown article categories");
assert.ok(adminEdge.includes("input.categories === undefined") && adminEdge.includes("currentSettings?.categories") && adminEdge.includes("currentSettings?.default_robots_index"), "Edge Function must preserve taxonomy and global SEO values when a legacy admin omits new fields");
assert.ok(dataSource.includes("categories:BlogCategory[]") && dataSource.includes("getBlogCategoryName") && dataSource.includes("getPostsByCategory=(slug:string)=>getBlogPosts().filter((post)=>getPostCategorySlugs(post).includes(slug))"), "public blog data must resolve Persian labels from stable English category slugs");
assert.ok(fetchScript.includes("categories:Array.isArray(s.categories)?s.categories:[]") && fetchScript.includes("default_robots_index"), "static build payload must include taxonomy and advanced SEO settings");
assert.ok(categoryPage.includes("settings.noindex_empty_categories") && categoryPage.includes("settings.default_robots_follow") && categoryPage.includes("item.name"), "category pages must use display labels and global/category robots rules");
assert.ok(sitemap.includes("settings.sitemap_include_categories") && sitemap.includes("settings.sitemap_include_articles") && sitemap.includes("category.count === 0"), "sitemap must respect global inclusion rules and empty-category noindex");
assert.ok(sitemap.includes("settings.canonical_url ||") && sitemap.includes("post.canonical_url ||") && sitemap.includes("category_seo?.[category.slug]?.canonical_url"), "sitemap must use the configured canonical URL for the archive, articles and categories");
assert.ok(sitemap.includes("settings.default_robots_index ?"), "a noindex blog archive must not be advertised in the sitemap");
assert.ok(articlePage.includes("settings.schema_type") && articlePage.includes("settings.open_graph_enabled") && articlePage.includes("settings.twitter_card_type") && articlePage.includes("settings.breadcrumbs_enabled") && articlePage.includes("robotsIndex"), "article pages must apply global schema, social, breadcrumb and robots defaults");
assert.ok(!articlePage.includes("mailto:") && !articlePage.includes(">ایمیل"), "article share row must not expose an email action");
assert.ok(!copyLinkButton.includes("\"use client\"") && copyLinkButton.includes("data-copy-link") && copyLinkButton.includes("data-copy-url") && copyLinkButton.includes("data-copy-feedback"), "copy-link markup must be a static server-rendered control, not a React hydration component");
assert.ok(blogCopyScript.includes('document.addEventListener("click"') && blogCopyScript.includes("navigator.clipboard.writeText") && blogCopyScript.includes('document.execCommand("copy")') && blogCopyScript.includes("showManualCopy") && blogCopyScript.includes("لینک کپی شد"), "standalone copy script must handle click, clipboard, fallback and success feedback");
assert.ok(articlePage.includes('<script src="/blog-copy.js" defer />') && blogCss.includes(".blog-share-copy-wrap [hidden]"), "static copy script must load on article routes under the same-origin CSP and keep inactive feedback hidden");
assert.ok(articlePage.includes('className="blog-reading-time-number"') && articlePage.includes('className="blog-reading-time-unit"') && listingClient.includes('className="blog-reading-time-number"') && listingClient.includes('className="blog-reading-time-unit"') && blogCss.includes('grid-template-areas:"unit number"') && blogCss.includes(".blog-reading-time.is-en") && blogCss.includes("grid-area:number") && blogCss.includes("grid-area:unit") && blogCss.includes("direction:ltr !important"), "reading-time number and unit must use explicit physical grid positions: Persian number right, unit left");
assert.ok(fetchScript.includes("ad_banners:Array.isArray(s.ad_banners)") && fetchScript.includes("show_on_mobile:banner.show_on_mobile!==false"), "static blog payload must preserve global ad banner settings from the public Supabase RPC");
assert.ok(adminHtml.includes('id="view-analytics"') && adminHtml.includes('data-view="analytics"') && adminApp.includes("async function loadArticleAnalytics") && adminApp.includes("function renderArticleAnalytics"), "the CMS must include a protected per-article analytics workspace");
assert.ok(adminApp.includes("analyticsEpoch") && adminApp.includes("state.articleAnalytics=null") && adminApp.includes("requestEpoch!==state.analyticsEpoch"), "cached article metrics must be cleared and in-flight reports invalidated at sign-in and logout");
assert.ok(canonicalMigration.includes("add column if not exists canonical_url") && canonicalMigration.includes("blog_get_public_blog_settings_extras"), "blog canonical URL must be persisted and included in the safe public payload");
assert.ok(dataSource.includes("canonical_url:string") && fetchScript.includes("canonical_url:s.canonical_url") && listingPage.includes("blogCanonicalUrl"), "blog canonical URL must flow from Supabase settings into static homepage metadata");
assert.ok(adminHtml.includes('id="setting-canonical-url"') && adminApp.includes('canonical_url:get("setting-canonical-url")') && adminEdge.includes("blogCanonicalUrl") && adminEdge.includes('url.pathname !== "/blog/"'), "blog admin must manage and validate only the canonical homepage URL");
assert.ok(adminApp.includes("function clipboardHeadingLevel") && adminApp.includes("font-size") && adminApp.includes("largest>=30") && adminApp.includes('tag==="h1"?2'), "Google Docs styled headings must be preserved and heading levels serialized without shifting");
assert.ok(markdownSource.includes("setext=lines[index+1].trim().match") && markdownSource.includes('class="blog-inline-image"'), "public Markdown renderer must preserve Setext headings and semantic images");
assert.ok(adminApp.includes("const setext=lines[index+1].trim().match") && adminApp.includes("renderPreviewMarkdown"), "CMS preview must render Setext and ATX heading structures");
const blogConsentBranch = analyticsConsent.slice(analyticsConsent.indexOf("if (blogRoute)"), analyticsConsent.indexOf("if (savedChoice ==="));
assert.ok(analyticsConsent.includes('const blogRoute = window.location.pathname === "/blog"') && analyticsConsent.includes('const persian = window.location.pathname.startsWith("/Mian-e-Ma/") || blogRoute') && blogConsentBranch.includes("panel.hidden = true") && blogConsentBranch.includes("preferences.hidden = true") && !blogConsentBranch.includes("preferences.hidden = false") && analyticsConsent.includes('if (blogRoute) return;') && analyticsConsent.includes('savedChoice === "granted"'), "blog paths must always hide the consent panel and floating preferences control while preserving consent-aware analytics and Persian labels");
assert.ok(notFoundContent.includes("usePathname") && notFoundContent.includes("not-found-blog") && notFoundCss.includes(".not-found-blog") && blogNotFound.includes("این آدرس به نوشته‌ای نمی‌رسه"), "blog must have a dedicated branded 404 page");
assert.ok(legacyCategoryMigration.includes("category = 'brand-and-business'") && legacyCategoryMigration.includes("category_seo =") && legacyCategoryMigration.includes("- 'برند-و-کسب‌وکار'"), "legacy Persian category metadata and article slugs must be removed or migrated");
assert.ok(legacyCategoryRedirect.includes('http-equiv="refresh"') && legacyCategoryRedirect.includes('http-equiv="Content-Security-Policy"') && legacyCategoryRedirect.includes("/blog/category/brand-and-business/") && legacyCategoryRedirect.includes('name="robots" content="noindex,follow"'), "the former Persian category URL must forward to the English archive without remaining indexable");
assert.ok(adminApp.includes("function categorySeoEntries()") && !adminApp.slice(adminApp.indexOf("function categorySeoEntries()"),adminApp.indexOf("function renderCategorySeoEditor")).includes("Object.entries(state.settings?.category_seo"), "orphaned category SEO keys must not create ghost categories in the CMS");
assert.ok(articlePage.includes("--blog-line-height") && articlePage.includes("--blog-paragraph-gap") && articlePage.includes("articleLineHeight * 1.05") && blogCss.includes("margin-block-end:var(--blog-paragraph-gap,2.05em)") && blogCss.includes("line-height:var(--blog-line-height,1.95)") && blogCss.includes("line-height:var(--blog-line-height,1.95);text-align:start;letter-spacing:normal"), "Persian paragraphs must use RTL-aware text rhythm and a gap slightly larger than line height on desktop and mobile");
assert.ok(adminHtml.includes("سایت‌مپ هم خودکار بازسازی می‌شه") && adminEdge.includes('if (tokenConfigured) await dispatchAfterWrite("save_settings")') && adminEdge.includes('await dispatchAfterWrite("publish_post")') && workflow.includes("workflow_dispatch:"), "saving category settings and publishing an article must trigger a site build and sitemap regeneration");


assert.ok(multipleCategoryMigration.includes("add column if not exists categories text[]") && multipleCategoryMigration.includes("add column if not exists primary_category text") && multipleCategoryMigration.includes("cardinality(categories) <= 3") && multipleCategoryMigration.includes("black-friday-history") && multipleCategoryMigration.includes("array['culture']"), "multi-category migration must add primary/secondary categories, cap at three and move Black Friday to Culture");
assert.ok(snapshotCategorySyncMigration.includes("published_snapshot = published_snapshot || jsonb_build_object") && snapshotCategorySyncMigration.includes("'categories'") && snapshotCategorySyncMigration.includes("'primary_category'"), "published article snapshots must receive multi-category metadata for public rendering");
assert.ok(categoryUtils.includes("export function getPostCategorySlugs") && categoryUtils.includes("export function getPrimaryCategorySlug"), "category helpers must be pure and client-safe");
assert.ok(!listingClient.startsWith('"use client"') && listingClient.includes('from "@/lib/blog-category-utils"') && listingClient.includes("data-category-slugs") && listingClient.includes("data-blog-search") && listingClient.includes("getPrimaryCategorySlug(post)") && !listingClient.includes('import { getBlogCategoryName } from "@/lib/blog-data"'), "blog archive must render static article cards and filter controls without React hydration");
assert.ok(listingClient.includes("searchableTerms") && listingClient.includes("categories.find((item) => item.slug === slug)?.name"), "blog search data must include localized labels for primary and secondary article categories");
assert.ok(adminHtml.includes('id="post-category-options"') && adminHtml.includes('id="post-primary-category"'), "article editor must expose multi-select categories and an explicit primary category");
assert.ok(adminApp.includes("function selectedEditorCategories()") && adminApp.includes("chosen.length>3") && adminApp.includes("post.primary_category=post.categories.includes"), "CMS must limit articles to three categories and persist an explicit primary category");
assert.ok(adminEdge.includes("rawCategories.length > 3") && adminEdge.includes("categories.length > 3") && adminEdge.includes("!categories.includes(primaryCategory)") && adminEdge.includes(".overlaps(\"categories\", removedSlugs)"), "Edge Function must validate the three-category limit, primary selection and protect secondary-category dependencies");
assert.ok(articlePage.includes("getPostCategorySlugs(post)") && articlePage.includes("getPrimaryCategorySlug(post)") && !articlePage.includes('blog-eyebrow"><span /> {categoryName'), "article page must use primary category and remove the category eyebrow above the title");
assert.ok(articlePage.includes('className="blog-article-title-highlight"') && articlePage.includes("settings.ad_banners") && articlePage.includes("blog-toc-mobile") && articlePage.includes("banner.link_rel") && articlePage.includes("rel={relValue}") && blogCss.includes("background:rgba(255, 255, 255,.82)") && blogCss.includes("box-decoration-break:clone") && blogCss.includes("aspect-ratio:1 / 1") && blogCss.includes(".blog-ad-label") && blogCss.includes(".blog-toc-mobile[open]"), "article pages must render global square ad slots below the desktop/mobile TOC and keep the mobile TOC collapsible");


assert.ok(dataSource.includes("export function formatBlogDate") && dataSource.includes("export function formatBlogDateParts") && dataSource.includes("formatToParts(date)") && listingClient.includes("formatBlogDate(post.published_at") && listingClient.includes("readingTime(post.content") && !listingClient.includes("function readingTime"), "article cards must share the centralized Persian date and reading-time implementation");
assert.ok(articlePage.includes("publishedDateParts.day") && articlePage.includes("publishedDateParts.month") && articlePage.includes("publishedDateParts.year") && articlePage.includes('className="blog-published-date"') && blogCss.includes(".blog-article-meta .blog-published-date") && blogCss.includes("direction:rtl !important") && blogCss.includes("unicode-bidi:isolate"), "Persian article dates must render day, month and year as separate bidirectional-safe parts");
assert.ok(adBannerMigration.includes("add column if not exists ad_banners jsonb not null default") && adBannerMigration.includes('"banner-1"') && adBannerMigration.includes('"banner-2"') && adBannerMigration.includes("image/gif") && adBannerMigration.includes("drop column if exists ad_banner_enabled"), "global advertising migration must create two disabled slots, allow GIF media and remove per-post banner columns");
assert.ok(adminHtml.includes('data-view="ads"') && adminHtml.includes('id="view-ads"') && !adminHtml.includes('data-tab="ads"') && adminApp.includes("function renderAdBannerSettings()") && adminApp.includes('api("save_ad_banners"'), "advertising controls must be global in the workspace, not attached to each article");
assert.ok(adminEdge.includes('action === "save_ad_banners"') && adminEdge.includes("ad_banners: banners") && adminEdge.includes("signature === \"GIF89a\"") && adminEdge.includes('"image/gif"') && !adminEdge.includes("ad_banner_enabled: adBannerEnabled"), "blog-admin must validate global banner settings and preserve animated GIF uploads instead of storing banners per post");
const articleAnalyticsRoute = analyticsEdge.indexOf("const articles = await getArticleAnalyticsData(google.accessToken)");
const realtimeAnalyticsRoute = analyticsEdge.indexOf('if (requestMode === "realtime")', articleAnalyticsRoute);
assert.ok(analyticsEdge.includes("historyReportResult") && analyticsEdge.includes("historyStatus") && articleAnalyticsRoute > analyticsEdge.indexOf("if (!google.configured)") && realtimeAnalyticsRoute > articleAnalyticsRoute, "site analytics must route article reports after Google configuration and include daily page-view history");
assert.ok(adminHtml.includes('id="article-analytics-chart-wrap"') && adminApp.includes("function renderArticleAnalyticsChart(history)") && adminApp.includes("renderArticleAnalyticsChart(data.history)") && adminCss.includes(".article-analytics-chart-line"), "blog analytics must follow the book dashboard pattern of metric cards, a trend chart and article-level details");
assert.ok(siteConfig.includes('id: "telegram", label: "Aria Kianzad on Telegram", href: "https://t.me/KianzadAria"') && !siteConfig.includes('id: "medium"') && socialIcons.includes('"telegram":') && !socialIcons.includes('"medium":') && socialIconExtractor.includes('"telegram"') && !socialIconExtractor.includes('"medium"') && telegramIconSource.includes("<title>Telegram</title>") && publicHeader.includes('telegram: "تلگرام"'), "site and blog footers must replace Medium with the Telegram channel icon and destination");


assert.ok(dataSource.includes("export type BlogAdBanner") && dataSource.includes("ad_banners:BlogAdBanner[]") && dataSource.includes("ad_banners:Array.isArray(parsed.settings?.ad_banners)?parsed.settings.ad_banners:defaults.ad_banners"), "public blog settings must include the safe global advertising array with defaults");
assert.ok(adminHtml.includes('data-view="ads"') && adminHtml.includes('id="view-ads"') && adminHtml.includes('id="ad-banners-form"') && adminHtml.includes('id="add-ad-banner"') && !adminHtml.includes('data-tab="ads"') && !adminHtml.includes('id="post-ad-banner-enabled"'), "advertising must live in its own workspace section, not in the article editor");
assert.ok(adminApp.includes("function renderAdBannerSettings()") && adminApp.includes("function collectAdBannersFromForm()") && adminApp.includes('api("save_ad_banners"') && adminApp.includes('accept="image/jpeg,image/png,image/webp,image/gif"'), "workspace must manage multiple ad slots, their labels, images, destinations and link types");
assert.ok(adminApp.includes("if(file.type===\"image/gif\")") && adminApp.includes("blob=file") && adminApp.includes("window.setInterval") && adminApp.includes("60*60*1000") && adminApp.includes("loadArticleAnalytics(true,true)"), "animated GIF uploads must remain unconverted and the article analytics report must refresh hourly while the admin session is active");
assert.ok(blogCss.includes(".blog-article-meta {\n    display:flex !important;") && blogCss.includes("direction:inherit;") && articlePage.includes('dir={direction}') && !articlePage.includes("style={"), "desktop article metadata must use the article language direction without CSP-blocked style attributes");

console.log("Personal blog contract passed: secure CMS, rich paste, category SEO, accessible formatting, responsive reading and isolated Persian editorial chrome.");

assert.ok(blogCss.includes(".blog-theme .blog-article-sidebar {\n  position:sticky;") && blogCss.includes(".blog-theme .blog-article-sidebar .blog-toc {\n  position:static;") && blogCss.includes("@media(max-width:700px) {\n  .blog-theme .blog-article-sidebar {\n    position:static;") && articlePage.includes("sidebarAdBanners.map"), "desktop TOC and ad cards must share one sticky sidebar while mobile sidebar stays in document flow");


assert.ok(contactPage.includes("اسپانسری دوره‌ای و بنرهای تبلیغاتی") && contactPage.includes("جایگاه‌های مشخص صفحه‌های مقاله"), "the contact page must describe periodic sponsorship and article banner placements");
assert.ok(adminApp.includes('function normalizeAdBanners(value)') && adminApp.includes('makeDefaultAdBanner(3)') && adminApp.includes('data-ad-field="show_on_mobile"') && adminApp.includes('banner.show_on_mobile!==false'), "the CMS must keep three core placements and expose per-banner mobile visibility");
assert.ok(adminEdge.includes("input.length < 3") && adminEdge.includes("show_on_mobile: item.show_on_mobile !== false") && adminEdge.includes('banner.id === "banner-3"'), "the admin API must persist mobile visibility and retain the article-end placement");
assert.ok(dataSource.includes("show_on_mobile:boolean") && dataSource.includes('id:"banner-3"') && fetchScript.includes("show_on_mobile:banner.show_on_mobile!==false"), "the public build payload must normalize mobile visibility and include the third slot");
assert.ok(articlePage.includes('banner.id !== "banner-3"') && articlePage.includes('banner.id === "banner-3"') && articlePage.includes("blog-in-article-ad-slot") && articlePage.includes("blog-prose-content"), "the third ad must render after the article HTML inside the article column, not in the sidebar");
assert.ok(blogCss.includes("aspect-ratio:8.5 / 1") && blogCss.includes("object-fit:contain") && blogCss.includes(".blog-in-article-ad.is-desktop-only"), "the article-end banner must preserve its full artwork and hide on mobile only when configured");
assert.ok(adminCss.includes(".ad-management-preview.is-article-end {aspect-ratio:8.5 / 1}") && adminCss.includes(".ad-mobile-toggle"), "the CMS must preview the horizontal banner ratio and expose the mobile toggle");
assert.ok(responsiveAdMigration.includes('"banner-3"') && responsiveAdMigration.includes("'show_on_mobile'") && responsiveAdMigration.includes("between 3 and 8"), "the migration must seed the third slot and backfill mobile visibility without overwriting configured banners");
assert.ok(adminApp.includes('relation="follow",target=external?"_blank":"_self"') && adminApp.includes('anchor.dataset.linkRel=relation') && adminApp.includes('||"follow";'), "all unconfigured editor links must default to follow while explicit link relations remain persistent");
assert.ok(!adminApp.slice(adminApp.indexOf("function clipboardHeadingLevel"),adminApp.indexOf("function cleanClipboardNode")).includes('querySelectorAll?.("[style]")'), "Google Docs heading detection must not promote an entire paragraph based on a single styled child run");

assert.ok(adminApp.includes('explicitRelation==="follow"') && adminApp.includes('if(relation!=="follow"||explicitRelation==="follow")'), "an explicitly selected follow relation must survive Markdown serialization and subsequent editing");
assert.ok(adminHtml.includes('app.js?v=20261128-3') && adminHtml.includes('blog.css?v=20261128-2'), "the admin editor assets must use current cache keys after the link-preview accessibility fix");
assert.ok(adminApp.includes("function handleNumberedHeadingEnter(event)") && adminApp.includes('$("#post-content").addEventListener("keydown",handleNumberedHeadingEnter)') && adminApp.includes('list?.tagName!=="OL"') && adminApp.includes("numberedListItemHasHeading(item)") && adminApp.includes("trailing.extractContents()") && adminApp.includes('const nextItem=document.createElement("li")'), "Enter inside a numbered heading item must create continuation paragraphs in the same LI and only create the next LI from an empty continuation");
assert.ok(blogCss.includes(".blog-prose li>h3") && blogCss.includes("display:block") && blogCss.includes(".blog-prose li>h3 + p") && adminCss.includes(".editor-richtext li>h3") && adminCss.includes(".editor-richtext li>h3 + p") && adminCss.includes("display:block"), "numbered H3 headings and their descriptions must remain separate visual blocks inside one list item");
assert.ok(adminHtml.includes("وقتی به خط خالی رسیدی، یک Enter دیگه شمارۀ بعدی رو می‌سازه"), "the editor must explain how to continue the current numbered item and start the next one");
assert.ok(blogCss.includes(".blog-prose li>strong:first-child") && blogCss.includes(".blog-prose li>h3 + p") && blogCss.includes("display:block"), "public H3 list items and their explanatory paragraphs must render on separate lines");
assert.ok(adminCss.includes(".editor-richtext li>strong:first-child") && adminCss.includes(".markdown-preview li>strong + p") && adminCss.includes(".editor-richtext li>h3 + p") && adminCss.includes("display:block"), "the rich-text editor and Markdown preview must keep H3 descriptions below their headings");
assert.ok(adminApp.includes('["follow","nofollow","sponsored","ugc"].includes(value)') && adminApp.includes('["nofollow","sponsored","ugc"].includes(v)') && adminApp.includes('const external=/^https?:\\/\\//i.test(href)'), "clipboard and editor link settings must preserve explicit nofollow, sponsored and UGC values while defaulting unmarked links to follow");


const collectPostSource = adminApp.slice(adminApp.indexOf("function collectPost()"), adminApp.indexOf("function updateEditorStatus"));
assert.ok(collectPostSource.includes("post.robots_follow=true") && !adminHtml.includes('id="post-robots-follow"'), "article robots follow must continue inheriting the global setting instead of exposing a per-article override");
assert.ok(adminHtml.includes('role="tablist" aria-label="تنظیمات مقاله"') && adminHtml.includes('role="tab" aria-selected="true"') && adminHtml.includes('role="tabpanel"') && adminApp.includes('showTab(tabs[nextIndex].dataset.tab,true)') && adminApp.includes('button.setAttribute("aria-selected"'), "editor tabs must expose selected state, labelled panels and keyboard arrow navigation");
assert.ok(adminHtml.includes('aria-current="page"') && adminHtml.includes('aria-controls="view-overview"') && adminApp.includes('button.setAttribute("aria-current","page")'), "the workspace navigation must expose the active view to assistive technology");
assert.ok(adminApp.includes("state.postSaveBusy") && adminApp.includes("state.publishBusy") && adminApp.includes("state.statusBusy") && adminApp.includes("ذخیرۀ مقاله در حال انجامه"), "article save, publish and status actions must guard against duplicate submissions");
assert.ok(adminApp.includes("state.editorDirty") && adminApp.includes("confirmLeaveEditor") && adminApp.includes("beforeunload") && adminApp.includes("تغییرات این مقاله هنوز ذخیره نشدن") && adminHtml.includes('id="editor-dirty-indicator"') && adminCss.includes(".editor-dirty-indicator"), "the editor must indicate unsaved changes and confirm before navigation or tab close");
assert.ok(adminApp.includes("state.editorChangeVersion===submittedVersion") && adminApp.includes("state.editorDirty){toast(\"ابتدا تغییرات مقاله رو ذخیره کن"), "saving must not clear changes typed while a request is in flight, and publication status changes must not discard unsaved edits");
assert.ok(adminApp.includes("با این جست‌وجو یا فیلتر، مقاله‌ای پیدا نشد.") && adminApp.includes("هنوز مقاله‌ای ایجاد نکردی"), "the article list must distinguish a truly empty workspace from an empty search result");
assert.ok(adminApp.includes("window.confirm(") && adminApp.includes("بعد از ذخیرۀ جایگاه‌ها، شمارش کلیک همین جایگاه هم پاک می‌شه"), "removing an additional ad slot must clearly confirm the impact before it is discarded");

assert.ok(adClickMigration.includes("create table if not exists public.blog_ad_click_counts") && adClickMigration.includes("alter table public.blog_ad_click_counts enable row level security") && adClickMigration.includes("revoke all on table public.blog_ad_click_counts from public, anon, authenticated"), "banner click totals must live in a private-to-browser table with RLS and no browser grants");
assert.ok(adClickMigration.includes("private.blog_ad_click_rate_limits") && adClickMigration.includes("p_fingerprint text") && adClickMigration.includes("cron.schedule"), "the initial click-tracking migration must create private fingerprint throttling and cleanup");
assert.ok(adClickHardeningMigration.includes("primary key (fingerprint, banner_id)") && adClickHardeningMigration.includes("request_count > 10") && adClickHardeningMigration.includes("interval '1 hour'"), "click throttling must cap each banner and trusted fingerprint at ten events per hour");
assert.ok(adClickHardeningMigration.includes("blog-contact-rate-limit-cleanup") && adClickHardeningMigration.includes("cron.schedule") && !adClickHardeningMigration.includes("DELETE FROM private.blog_contact_rate_limits;"), "contact rate-limit cleanup must run on a scheduled job rather than on every submission");
assert.ok(adClickMigration.includes("security invoker") && adClickMigration.includes("grant execute on function public.record_blog_ad_click(text, text) to service_role") && adClickMigration.includes("grant execute on function public.reset_blog_ad_click_count(text) to service_role"), "click and reset RPCs must run as invoker and be executable only by service_role");
assert.ok(adClickEdge.includes('request.headers.get("cf-connecting-ip")') && adClickEdge.includes("HMAC") && !adClickEdge.includes('request.headers.get("x-forwarded-for")') && adClickEdge.includes('origin !== SITE_ORIGIN') && adClickEdge.includes('record_blog_ad_click'), "public click endpoint must validate the site origin, trust only managed ingress IP metadata and hash it before rate limiting");
assert.ok(adClickEdge.includes("function trustedClientIp(request: Request): string | null") && adClickEdge.includes("if (!clientIp) return json({ ok: true, counted: false }, 202)"), "click tracking must not merge visitors into a shared missing-IP bucket");
assert.ok(adClickEdge.includes(String.raw`/[,;\s]/`), "click tracking must reject whitespace and delimiter-separated client IP headers");
const clickFunctionConfig = configToml.slice(configToml.indexOf("[functions.blog-ad-click]"));
assert.ok(adClickEdge.includes('requestContentType.includes("text/plain")') && adClickEdge.includes('requestContentType.includes("application/json")') && clickFunctionConfig.startsWith("[functions.blog-ad-click]") && clickFunctionConfig.includes("verify_jwt = false"), "the public click endpoint must accept simple beacon content types without requiring platform JWT verification");
assert.ok(adClickTracker.includes("navigator.sendBeacon") && adClickTracker.includes('new Blob([payload], { type: "text/plain;charset=UTF-8" })') && adClickTracker.includes('"Content-Type": "text/plain;charset=UTF-8"') && !adClickTracker.includes("apikey:"), "the browser tracker must avoid a CORS preflight and use fetch keepalive only as a sendBeacon fallback");
assert.ok(adClickEdge.includes("Do not expose the absolute click total publicly") && adClickEdge.includes("counted:"), "the public click endpoint must not disclose internal click totals");
class MockTrackerElement {
  constructor(tagName, attributes = {}, parent = null) {
    this.tagName = tagName;
    this.attributes = attributes;
    this.parentElement = parent;
  }
  matches(selector) {
    return selector === "a[data-ad-click]" && this.tagName === "A" && typeof this.attributes["data-ad-click"] === "string";
  }
  closest(selector) {
    if (this.matches(selector)) return this;
    return this.parentElement ? this.parentElement.closest(selector) : null;
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
}
class MockTrackerBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options.type;
  }
}
function makeTrackerTestContext(sendBeacon) {
  const events = {};
  const beacons = [];
  const requests = [];
  const link = new MockTrackerElement("A", {"data-ad-click":"banner-1"});
  const image = new MockTrackerElement("IMG", {}, link);
  const context = {
    window: {MIAN_E_MA_DASHBOARD_CONFIG:{supabaseUrl:"https://project.supabase.co"}},
    document: {
      addEventListener(type, handler, options) {
        events[type] = {handler, options};
      },
    },
    navigator: {
      sendBeacon(url, body) {
        beacons.push({url,body});
        return sendBeacon(url,body);
      },
    },
    Element: MockTrackerElement,
    Blob: MockTrackerBlob,
    fetch: (url, options) => {
      requests.push({url,options});
      return Promise.resolve({ok:true,status:202});
    },
  };
  runInNewContext(adClickTracker, context);
  return {events,beacons,requests,link,image};
}
const beaconTracker = makeTrackerTestContext(() => true);
assert.ok(beaconTracker.events.click && beaconTracker.events.click.options.capture && beaconTracker.events.click.options.passive, "the banner tracker must register an early passive capture listener");
beaconTracker.events.click.handler({
  target:beaconTracker.image,
  defaultPrevented:true,
  button:2,
  composedPath:()=>[beaconTracker.image,beaconTracker.link],
});
assert.equal(beaconTracker.beacons.length,1,"a banner activation must be queued with sendBeacon even when another listener prevents navigation");
assert.equal(beaconTracker.beacons[0].url,"https://project.supabase.co/functions/v1/blog-ad-click","the beacon must target the configured Supabase endpoint");
assert.equal(beaconTracker.beacons[0].body.type,"text/plain;charset=UTF-8","sendBeacon must use a CORS-safelisted text/plain body");
assert.deepEqual(JSON.parse(beaconTracker.beacons[0].body.parts[0]),{banner_id:"banner-1"},"the beacon must include the stable banner slot ID");
assert.equal(beaconTracker.requests.length,0,"successful sendBeacon queueing must avoid a competing fetch request");
const fallbackTracker = makeTrackerTestContext(() => false);
fallbackTracker.events.click.handler({
  target:fallbackTracker.image,
  defaultPrevented:false,
  button:0,
  composedPath:()=>[fallbackTracker.image,fallbackTracker.link],
});
assert.equal(fallbackTracker.requests.length,1,"fetch keepalive must be used when sendBeacon cannot queue the request");
assert.equal(fallbackTracker.requests[0].url,"https://project.supabase.co/functions/v1/blog-ad-click","the fetch fallback must target the click endpoint");
assert.equal(fallbackTracker.requests[0].options.headers["Content-Type"],"text/plain;charset=UTF-8","the fetch fallback must avoid a preflight-triggering JSON content type");
assert.equal(Object.hasOwn(fallbackTracker.requests[0].options.headers,"apikey"),false,"the click endpoint must not require a custom apikey header");
assert.ok(fallbackTracker.requests[0].options.keepalive && fallbackTracker.requests[0].options.mode==="cors","the fallback request must survive navigation without blocking the destination");
assert.ok(adClickTracker.includes('document.addEventListener("click", trackBannerClick, { capture: true, passive: true })') && adClickTracker.includes("sendBeacon") && adClickTracker.includes("text/plain;charset=UTF-8") && adClickTracker.includes("keepalive: true") && adClickTracker.includes('"/functions/v1/blog-ad-click"'), "public banner clicks must use a no-preflight beacon with a keepalive fetch fallback");
assert.ok(blogLayout.includes('<script src="/admin/config.js" />') && blogLayout.includes('<script src="/blog-ad-click.js" />') && !blogLayout.includes("/blog-ad-click.js\" defer") && blogLayout.indexOf('/admin/config.js') < blogLayout.indexOf('/blog-ad-click.js') && blogLayout.indexOf('/blog-ad-click.js') < blogLayout.indexOf("{children}") && articlePage.includes("data-ad-click={banner.id}") && articlePage.includes("data-ad-click={articleEndBanner.id}"), "the configuration and click listener must load synchronously, in order, before article banner links become interactive");
assert.ok(adminEdge.includes('action === "get_ad_click_counts"') && adminEdge.includes('action === "reset_ad_click_count"') && adminEdge.includes("reset_blog_ad_click_count") && adminEdge.includes("blog_ad_click_counts"), "authenticated admin API must return per-slot totals and reset only the selected banner");
assert.ok(adClickExpansionMigration.includes("banner-[1-9][0-9]*") && adClickExpansionMigration.includes("create or replace function public.record_blog_ad_click") && adClickExpansionMigration.includes("create or replace function public.reset_blog_ad_click_count") && adClickEdge.includes("/^banner-[1-9][0-9]*$/") && adClickTracker.includes("/^banner-[1-9][0-9]*$/") && adminEdge.includes("/^banner-[1-9][0-9]*$/"), "custom banner IDs must remain unique across repeated remove-and-add cycles without exceeding the eight simultaneously configured slots");
assert.ok(adminApp.includes('api("get_ad_click_counts")') && adminApp.includes('api("reset_ad_click_count"') && adminApp.includes("data-ad-click-count") && adminApp.includes("data-reset-ad-clicks") && adminApp.includes("window.confirm(") && adminHtml.includes("به‌روزرسانی آمار"), "the ad workspace must display per-banner click totals and confirm independent resets");
assert.ok(adminCss.includes(".ad-click-metrics") && adminCss.includes(".ad-click-stat") && adminCss.includes(".ad-reset-clicks") && adminCss.includes("@media(max-width:600px)"), "click metrics and reset controls must remain legible and operable on mobile");


// The public blog now shares the homepage's exact paper / ink / aubergine / brass system.
const [blogRobotsSource, blogOgSource] = await Promise.all([
  read("src/app/robots.ts"),
  read("scripts/generate-blog-og.mjs"),
]);
for (const token of [
  "--blog-paper:#FBFBF7",
  "--blog-surface:#FFFFFF",
  "--blog-deep:#F0E8EB",
  "--blog-ink:#251B20",
  "--blog-ink-soft:#5A4A51",
  "--blog-muted:#7D6D74",
  "--blog-accent:#782C44",
  "--blog-signal:#E3B72F",
  "--blog-panel-dark:#2A1921",
]) {
  assert.ok(blogCss.includes(token), "blog CSS must include homepage palette token " + token);
}
assert.ok(!/(#1d3432|#405653|#f4f1e9|#e9e5da|#d8d5ca|#777f77|#7d9b7e|#b36f61)/i.test(blogCss),
  "the previous teal, green and warm-brown blog palette must not remain in the public blog stylesheet");
assert.ok(blogLayout.includes("--blog-heading-scale") && !blogLayout.includes("settings.accent_color"),
  "the public blog palette must not be overridden by the CMS accent setting");
assert.ok(articlePage.includes("--post-accent:var(--blog-accent)") && !articlePage.includes("const postAccent"),
  "article-level accents must inherit the shared brand accent without modifying stored post content");
assert.ok(blogOgSource.includes('const accent="#782C44"') &&
  blogOgSource.includes('fill="#E3B72F"') &&
  blogOgSource.includes('fill="#FBFBF7"'),
  "fallback blog social previews must use the same paper, aubergine and brass palette");
assert.ok(blogRobotsSource.includes('site.url + "/sitemap.xml"') &&
  blogRobotsSource.includes('site.url + "/blog/feed.xml"') &&
  blogRobotsSource.includes("settings.enable_rss"),
  "robots.txt must advertise both the XML sitemap and the enabled RSS discovery feed");
assert.ok(sitemap.includes("archiveLastModified") && sitemap.includes("categoryLastModified"),
  "the sitemap must expose verifiable last-modified timestamps for the archive and category pages");
assert.ok(rssRoute.includes("<lastBuildDate>") && rssRoute.includes("lastBuildDate"),
  "the static RSS feed must publish a lastBuildDate for the latest published update");
const [llmsContent, adminDashboardHtml] = await Promise.all([
  read("public/llms.txt"),
  read("public/admin/index.html"),
]);
assert.ok(llmsContent.includes("https://github.com/AriaKianzad/ariakianzad.github.io/releases/download/mian-e-ma-v1/Mian-e-Ma.pdf") &&
  !llmsContent.includes("https://ariakianzad.github.io/Mian-e-Ma/assets/Mian-e-Ma.pdf"),
  "llms.txt must reference the published GitHub Release PDF rather than a non-existent site asset");
assert.ok(adminHtml.includes('name="robots" content="noindex, nofollow, noarchive"') &&
  adminDashboardHtml.includes('name="robots" content="noindex, nofollow, noarchive"'),
  "both admin entry pages must retain noindex directives after robots.txt allows crawling");
