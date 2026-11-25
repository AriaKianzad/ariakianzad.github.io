import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script, runInNewContext } from "node:vm";
import ts from "typescript";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [
  packageJson, fetchScript, imageScript, dataSource, markdownSource,
  listingPage, articlePage, categoryPage, rssRoute, blogCss, adminHtml, adminCss,
  adminApp, adminEdge, publicRpcMigration, browserDenyMigration, snapshotMigration,
  publicHeader, workflow, sitemap, robots, heroVisualComponent, signalScene, heroBootstrap,
  blogLayout, contactPage, contactForm, contactEdge, contactMigration, rootLayout, configToml, googleContactScript, contactBrowserScript,
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
  read("src/app/blog/layout.tsx"),
  read("src/app/blog/contact/page.tsx"),
  read("src/app/blog/contact/ContactForm.tsx"),
  read("supabase/functions/blog-contact/index.ts"),
  read("supabase/migrations/20261123150911_add_blog_contact_rate_limit.sql"),
  read("src/app/layout.tsx"),
  read("supabase/config.toml"),
  read("integrations/google-apps-script/blog-contact.gs"),
  read("public/blog-contact.js"),
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
assert.ok(rootLayout.includes('<script src="/blog-listing.js" defer />'), "static blog search behavior must load as a same-origin script");
assert.ok(listingPage.includes('"@type": "Blog"'), "the archive must include Blog structured data");
assert.ok(articlePage.includes("generateStaticParams"), "published articles must be statically generated");
assert.ok(articlePage.includes('{ slug: "__empty__" }') && articlePage.includes("robots: { index: false, follow: false }"), "empty article fallback must remain noindex");
assert.ok(articlePage.includes('"@context": "https://schema.org"') && articlePage.includes('"@type": settings.schema_type'), "articles must use the configured structured data type");
assert.ok(articlePage.includes('"@type": "FAQPage"'), "FAQ schema must be available");
assert.ok(articlePage.includes("canonical") && articlePage.includes("robots_index"), "article SEO must support canonical and robots directives");
assert.ok(articlePage.includes("openGraph:") && articlePage.includes("twitter:"), "article metadata must include OG and X cards");
assert.ok(articlePage.includes('const image = site.url + "/og/blog/" + post.slug + ".jpg"'), "article OG and X metadata must use the normalized 1200x630 build asset rather than the raw uploaded image");
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
assert.ok(sitemap.includes("getBlogPosts()") && sitemap.includes("/blog/"), "sitemap must include published articles and blog archive");
assert.ok(sitemap.includes("/blog/contact/"), "sitemap must include the public contact page");
assert.ok(robots.includes('disallow: ["/admin/", "/admin/blog/"]'), "robots.txt must disallow both admin areas");
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
});
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

const inlineSerializer = adminApp.slice(adminApp.indexOf("function inlineToMarkdown"),adminApp.indexOf("function listToMarkdown"));
const blockSerializer = adminApp.slice(adminApp.indexOf("function blockToMarkdown"),adminApp.indexOf("function editorToMarkdown"));
assert.ok(["tag===\"strong\"","tag===\"em\"","tag===\"u\"","tag===\"del\"","tag===\"code\"","tag===\"a\"","tag===\"img\""].every((token)=>inlineSerializer.includes(token)), "the editor serializer must preserve emphasis, underline, deletion, code, links and images");
assert.ok(["tag===\"figure\"","/^h[1-6]$/","tag===\"p\"","tag===\"ul\"","tag===\"ol\"","tag===\"blockquote\"","tag===\"pre\"","tag===\"hr\"","tag===\"table\""].every((token)=>blockSerializer.includes(token)), "the editor serializer must preserve all supported block structures");
const cmsPreviewRenderer = adminApp.slice(adminApp.indexOf("function renderPreviewMarkdown"),adminApp.indexOf("function inlineToMarkdown"));
assert.ok(cmsPreviewRenderer.includes("const parseListItem=") && cmsPreviewRenderer.includes("listStack") && cmsPreviewRenderer.includes("if(!parseListItem(") && cmsPreviewRenderer.includes("appendListItem(item)"), "the CMS preview must preserve blank-separated and nested list structure");

assert.ok(blogCss.includes(".blog-prose ul{list-style-type:disc}") && blogCss.includes(".blog-prose ol{list-style-type:decimal}") && blogCss.includes(".blog-prose li::marker"), "public article lists must explicitly restore bullets and numbering after the portfolio-wide list reset");
assert.ok(["h2","h3","h4","p","strong","em","u","del","a","blockquote","pre","code","img","hr"].every((tag)=>blogCss.includes(".blog-prose "+tag)), "public article CSS must style every semantic text format emitted by the Markdown renderer");
assert.ok(blogCss.includes(".blog-theme .blog-related .blog-card-copy{padding:26px 28px 22px}") && blogCss.includes("padding-block:72px clamp(48px,6vw,88px)"), "related article cards must keep internal breathing room and remain separated from the footer");
assert.ok(adminCss.includes(".editor-richtext strong") && adminCss.includes(".editor-richtext em") && adminCss.includes(".editor-richtext u") && adminCss.includes(".editor-richtext del") && adminCss.includes(".editor-richtext ul { list-style:disc; }") && adminCss.includes(".markdown-preview article ol { list-style-type:decimal; }"), "the CMS editing surface and live Markdown preview must both style inline formats and list markers");

assert.ok(siteChrome.includes("usePathname") && siteChrome.includes("isBlog"), "blog routes must not inherit the portfolio chrome");
assert.ok(listingPage.includes('settings.tagline || "یادداشت‌هایی درباره برند، معنا و ارتباط"'), "blog archive H1 must use the descriptive tagline");
assert.ok(listingPage.includes('import HeroVisual from "@/components/hero-visual"') && listingPage.includes("<HeroVisual />"), "blog archive must reuse the homepage signal animation");
assert.ok(!listingPage.includes("یادداشت‌ها و مقاله‌ها") && !listingPage.includes("ایده‌ها، تحقیق و نگاه شخصی") && !listingPage.includes("آرشیو نوشته‌ها"), "blog archive must remove the three redundant microcopy labels");
assert.ok(listingPage.includes("blog-intro-copy") && listingPage.includes("blog-intro-visual"), "blog intro must separate its title from the animation area");
assert.ok(heroVisualComponent.includes("data-hero-visual") && signalScene.includes('getPropertyValue("--blog-accent")'), "shared hero scene must support the blog colour palette");
assert.ok(heroBootstrap.includes("MutationObserver") && heroBootstrap.includes("syncRoots"), "hero scene must initialize after client-side route changes");
assert.ok(publicHeader.includes("<span>آریا کیانزاد</span>"), "blog header brand must show the author's name");
assert.ok(blogCss.includes(".blog-theme .blog-header-blog-link {") && blogCss.includes('grid-template-areas:"visual copy"') && blogCss.includes("position:absolute;"), "blog header and hero must retain their desktop/mobile layout contracts");
assert.ok(listingPage.includes("blog-intro-description") && listingPage.includes("settings.description"), "blog homepage must show the configured homepage description separately from its SEO description");
assert.ok(blogCss.includes(".blog-theme .blog-intro > .blog-intro-description") && blogCss.includes("grid-column:1 / -1") && blogCss.includes("max-width:none"), "homepage description must have a full-width responsive row on mobile and desktop");
assert.ok(blogLayout.includes("/blog-favicon.svg") && blogLayout.includes('themeColor: "#f4f1e9"'), "blog must use its own favicon and browser theme colour");
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
assert.ok(rootLayout.includes('<script src="/blog-contact.js" defer />'), "contact behavior must be loaded as an external first-party script allowed by the CSP");
assert.ok(contactBrowserScript.includes("sb_publishable_") && contactBrowserScript.includes("crypto.randomUUID"), "contact browser script must include the public Supabase key and unique submission id");
assert.ok(!contactForm.includes("targetUrl") && !contactForm.includes("anchorText") && !contactForm.includes("contact-target") && !contactForm.includes("contact-anchor"), "contact form must not ask for destination URLs or anchor text");
assert.ok(!contactForm.includes("developers.google.com/search/docs/essentials/spam-policies") && !contactForm.includes("لینک Follow در ازای پرداخت ارائه نمی‌شه"), "contact form must not show the paid-link policy paragraph");
assert.ok(contactEdge.includes('editorial_link: "بررسی ارجاع تحریریه‌ای Follow بدون پرداخت بابت لینک"'), "contact endpoint must distinguish unpaid editorial link requests from paid advertorials");
assert.ok(contactEdge.includes('request.headers.get("cf-connecting-ip")') && !contactEdge.includes('"x-real-ip"') && !contactEdge.includes('"x-forwarded-for"'), "contact rate limiting must not trust caller-controlled forwarding-header fallbacks");
assert.ok(contactEdge.includes('name: "HMAC"') && contactEdge.includes('hash: "SHA-256"'), "contact rate-limit fingerprints must use keyed HMAC-SHA-256");
assert.ok(contactEdge.includes("GOOGLE_APPS_SCRIPT_URL") && contactEdge.includes("GOOGLE_APPS_SCRIPT_TOKEN") && !contactEdge.includes("RESEND_API_KEY"), "contact Edge Function must route email delivery through the private Google Apps Script endpoint");
assert.ok(googleContactScript.includes("MailApp.sendEmail") && googleContactScript.includes("BLOG_CONTACT_TOKEN") && googleContactScript.includes("BLOG_CONTACT_TO_EMAIL") && googleContactScript.includes("CacheService"), "Google Apps Script mail sender must protect its endpoint, use the owner's Gmail and deduplicate submissions");
assert.ok(contactEdge.includes("consume_blog_contact_rate_limit") && contactEdge.includes("companyFax") && contactEdge.includes("SITE_ORIGIN"), "contact endpoint must enforce origin, honeypot and rate limits");
assert.ok(contactMigration.includes("private.blog_contact_rate_limits") && contactMigration.includes("SECURITY DEFINER") && contactMigration.includes("GRANT EXECUTE ON FUNCTION public.consume_blog_contact_rate_limit"), "contact rate limiting must use a private database function");
assert.ok(signalScene.includes("new THREE.SphereGeometry(0.92, 96, 80)") && signalScene.includes("new THREE.WireframeGeometry(innerGeometry)") && signalScene.includes("new THREE.HemisphereLight") && signalScene.includes('window.matchMedia("(max-width: 700px)").matches ? 2.72 : 2.35') && signalScene.includes("visibleHalfHeight / Math.tan"), "blog signal scene must fit the lit sphere and orbit geometry inside its responsive canvas");
assert.ok(signalScene.includes("new THREE.IcosahedronGeometry(0.92, 5)") && signalScene.includes("new THREE.MeshStandardMaterial({") && signalScene.includes("wireGeometry?.dispose()"), "homepage hero must keep its original mesh and clean up the optional blog wireframe safely");
assert.ok(rootLayout.includes("https://bkohdqwecnvbmeaiuyyx.supabase.co;") && !rootLayout.includes("'unsafe-inline'"), "site CSP must allow contact form requests without permitting inline scripts");
assert.ok(configToml.includes("[functions.blog-contact]") && configToml.includes("verify_jwt = false"), "contact Edge Function must have public JWT configuration");
assert.ok(!articlePage.includes("ARTICLE / ARCHIVE") && !categoryPage.includes("CATEGORY / ARCHIVE"), "public blog screens must not expose English archive labels");
assert.ok(!adminHtml.includes("Google Docs") && !adminHtml.includes("Open Graph") && !adminHtml.includes(">English<"), "CMS visible interface copy must be Persian");
assert.ok(blogCss.includes("body:has(.blog-theme)") && blogCss.includes("font-family:var(--font-estedad)"), "blog pages must keep their own shell and Estedad typography");
assert.ok(blogCss.includes('grid-template-areas:"visual copy"') && blogCss.includes("grid-template-columns:minmax(0,.86fr) minmax(0,1.14fr)") && blogCss.includes("aspect-ratio:1 / 1") && blogCss.includes("overflow:visible") && blogCss.includes("font-size:clamp(24px,7.2vw,33px)"), "mobile blog hero must keep the animation beside a compact title without cropping or overlap");
assert.ok(blogCss.includes("max-width:410px") && blogCss.includes("height:clamp(260px,28vw,340px)") && blogCss.includes("max-width:220px"), "desktop and mobile blog hero visual sizes must stay within compact bounds");
assert.ok(blogCss.includes(`grid-template-areas:"hero" "meta"`) && blogCss.includes("background:rgba(248,244,232,.82)") && blogCss.includes("filter:brightness(.83) saturate(.9)") && blogCss.includes(".blog-article-meta {\n    grid-area:meta;\n    direction:rtl;"), "mobile article cover must keep the title readable without obscuring the featured image");
assert.ok(blogCss.includes("direction:rtl; text-align:right") && blogCss.includes(".blog-socials"), "blog footer must use RTL alignment and social icon links");
assert.ok(articlePage.indexOf("<h1>{post.title}</h1>") < articlePage.indexOf("<figure className=\"blog-hero-image\">"), "featured image must follow the article title");
assert.ok(publicHeader.includes("SocialIcon") && !publicHeader.includes("mailto:") && !publicHeader.includes("/#about"), "blog footer must remove email/about links and include social icons");

assert.ok(adminHtml.includes("مرا به خاطر بسپار") && !/EDITORIAL OVERVIEW|RECENT WORK|CONTENT LIBRARY|PRIVATE WORKSPACE|MAIN WEBSITE/.test(adminHtml), "CMS visible labels must be Persian and offer a remember-me option");
assert.ok(categoryTaxonomyMigration.includes("add column if not exists categories jsonb") && categoryTaxonomyMigration.includes("'brand-and-business'") && categoryTaxonomyMigration.includes("blog_get_public_blog_settings_extras"), "taxonomy migration must seed a stable English category slug and expose only curated public settings");
assert.ok(adminHtml.includes('id="post-category-options"') && adminHtml.includes('id="post-primary-category"') && adminHtml.includes('id="category-manager-list"') && adminHtml.includes('id="new-category-name"') && adminHtml.includes('id="new-category-slug"'), "CMS must expose managed categories with Persian labels and independent English slugs");
assert.ok(adminApp.includes("function getConfiguredCategories") && adminApp.includes("function addManagedCategory") && adminApp.includes("collectCategories(settings?.categories||[])") && adminApp.includes("renderCategoryManager(settings)"), "CMS must add, list, preserve and select managed categories");
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
assert.ok(rootLayout.includes('<script src="/blog-copy.js" defer />') && blogCss.includes(".blog-share-copy-wrap [hidden]"), "static copy script must load under the same-origin CSP and keep inactive feedback hidden");
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
assert.ok(articlePage.includes('className="blog-article-title-highlight"') && articlePage.includes("settings.ad_banners") && articlePage.includes("blog-toc-mobile") && articlePage.includes("banner.link_rel") && articlePage.includes("rel={relValue}") && blogCss.includes("background:rgba(248,244,232,.82)") && blogCss.includes("box-decoration-break:clone") && blogCss.includes("aspect-ratio:1 / 1") && blogCss.includes(".blog-ad-label") && blogCss.includes(".blog-toc-mobile[open]"), "article pages must render global square ad slots below the desktop/mobile TOC and keep the mobile TOC collapsible");


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
assert.ok(blogCss.includes(".blog-article-meta {\n    display:flex !important;") && blogCss.includes("direction:inherit;") && articlePage.includes('style={{ direction }}'), "desktop article metadata must use the article language direction and a stable flex layout");

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
assert.ok(adminApp.includes('relation=external?"nofollow":"follow"') && adminApp.includes('anchor.dataset.linkRel=relation'), "new external links must default to nofollow while explicit follow choices remain persistent");
assert.ok(!adminApp.slice(adminApp.indexOf("function clipboardHeadingLevel"),adminApp.indexOf("function cleanClipboardNode")).includes('querySelectorAll?.("[style]")'), "Google Docs heading detection must not promote an entire paragraph based on a single styled child run");

assert.ok(adminApp.includes('explicitRelation==="follow"') && adminApp.includes('if(relation!=="follow"||explicitRelation==="follow")'), "an explicitly selected follow relation must survive Markdown serialization and subsequent editing");
assert.ok(adminApp.includes('["follow","nofollow","sponsored","ugc"].includes(value)') && adminApp.includes('const external=/^https?:\\/\\//i.test(href)'), "clipboard sanitization must preserve explicit follow while defaulting pasted external links to nofollow");
