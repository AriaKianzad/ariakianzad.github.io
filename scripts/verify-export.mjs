/**
 * Postbuild invariant check. Runs after strip-next-runtime.mjs and exits 1
 * on any violation, so a broken export cannot ship quietly:
 *
 * - every same-origin asset referenced by an exported HTML file exists in
 *   out/ (scripts, stylesheets, font preloads, favicons, og:image, canonical)
 * - the only <script> tags left are same-origin files and JSON-LD data blocks
 * - no Next.js runtime script (src containing /_next/) remains
 * - any inline <style> has its sha256 hash in the _headers style-src list
 * - the files a deployment needs are present
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";

const outDir = join(process.cwd(), "out");
const problems = [];

const walk = (dir) => {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (name.endsWith(".html")) files.push(path);
  }
  return files;
};

const files = walk(outDir);

/** The canonical link defines which absolute URLs are this site's own. */
const indexHtml = readFileSync(join(outDir, "index.html"), "utf8");

/* Validate the profile graph and the founder relationship, not just JSON syntax. */
try {
  const tag = indexHtml.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!tag) {
    problems.push("index.html: JSON-LD ProfilePage block is missing");
  } else {
    const jsonLd = JSON.parse(tag[1]);
    const graph = Array.isArray(jsonLd["@graph"]) ? jsonLd["@graph"] : [jsonLd];
    const byType = (type) => graph.find((entry) => entry["@type"] === type);
    const profile = byType("ProfilePage");
    const person = byType("Person");
    const organization = graph.find((entry) => entry["@type"] === "Organization" && entry.url === "https://rexo.agency/");
    const personId = person?.["@id"];
    const organizationId = organization?.["@id"];
    if (!profile || profile.mainEntity?.["@id"] !== personId) {
      problems.push("index.html: ProfilePage.mainEntity must reference the Person entity");
    }
    if (!person || !Array.isArray(person.sameAs) || person.sameAs.length !== 6) {
      problems.push("index.html: Person.sameAs must contain the six supplied social profiles");
    }
    if (!organization || organization.founder?.["@id"] !== personId) {
      problems.push("index.html: Rexo Organization.founder must reference the Person entity");
    }
    if (!person || person.worksFor?.["@id"] !== organizationId) {
      problems.push("index.html: Person.worksFor must reference the Rexo Organization entity");
    }
    const socialHrefs = [...indexHtml.matchAll(/<a\s+class="social-link"\s+href="([^"]+)"/g)].map((match) => match[1]);
    if (person && Array.isArray(person.sameAs) &&
        (socialHrefs.length !== 6 || socialHrefs.some((href) => !person.sameAs.includes(href)))) {
      problems.push("index.html: Person.sameAs does not match the six rendered social links");
    }
  }
} catch (error) {
  problems.push(`index.html: invalid JSON-LD (${error.message})`);
}

const siteOrigin = (() => {
  try {
    const index = readFileSync(join(outDir, "index.html"), "utf8");
    const tag =
      index.match(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/) ||
      index.match(/<link\b[^>]*\bhref\s*=\s*["'][^"']*["'][^>]*\brel\s*=\s*["']canonical["'][^>]*>/);
    const href = tag && (tag[0].match(/\bhref\s*=\s*["']([^"']+)["']/) || [])[1];
    return href ? new URL(href).origin : null;
  } catch {
    return null;
  }
})();

/** Resolve same-origin references relative to the HTML file that contains them. */
const toLocalPath = (ref, relativeFile, kind) => {
  if (typeof ref !== "string" || ref.length === 0) return null;
  try {
    const origin = siteOrigin || "https://local.invalid";
    const base = new URL(relativeFile, origin + "/");
    const resolved = new URL(ref, base);
    if (resolved.origin !== base.origin) return null;
    const pathname = decodeURIComponent(resolved.pathname);
    if (!pathname.startsWith("/") || pathname.includes("\0") || pathname.includes("\\")) return null;
    if (/\/{2,}/.test(pathname)) {
      problems.push(relativeFile + ": " + kind + " target has repeated slashes in its path: " + ref);
    }
    return pathname.replace(/\/{2,}/g, "/");
  } catch {
    return null;
  }
};

const isInsideExport = (candidate) => {
  const rel = relative(outDir, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel));
};

const checkRef = (rel, ref, kind) => {
  const pathname = toLocalPath(ref, rel, kind);
  if (pathname === null) return;

  const cleanPath = pathname.replace(/^\/+/, "");
  const direct = resolve(outDir, cleanPath || "index.html");
  const candidates = [
    direct,
    direct + ".html",
    resolve(direct, "index.html"),
  ];

  const found = candidates.some((candidate) =>
    isInsideExport(candidate) &&
    existsSync(candidate) &&
    statSync(candidate).isFile()
  );
  if (!found) problems.push(rel + ": missing " + kind + " target: " + ref);
};

const headersRaw = existsSync(join(outDir, "_headers")) ? readFileSync(join(outDir, "_headers"), "utf8") : "";
const htaccessRaw = existsSync(join(outDir, ".htaccess")) ? readFileSync(join(outDir, ".htaccess"), "utf8") : "";

/* The CSP must be identical in both deployment configs and must never
   contain 'unsafe-inline'. */
const headersCsp = (headersRaw.match(/Content-Security-Policy:\s*(.+)/) || [])[1]?.trim() ?? null;
const htaccessCsp = (htaccessRaw.match(/Header\s+always\s+set\s+Content-Security-Policy\s+"([^"]+)"/) || [])[1] ?? null;
if (headersCsp === null) problems.push("_headers: no Content-Security-Policy directive found");
if (htaccessCsp === null) problems.push(".htaccess: no Content-Security-Policy header found");
if (/^\s*Strict-Transport-Security\s*:/im.test(headersRaw)) {
  problems.push("_headers: HSTS is disabled by default; confirm HTTPS readiness for all subdomains before enabling it");
}
if (/^\s*Header\s+always\s+set\s+Strict-Transport-Security\b/im.test(htaccessRaw)) {
  problems.push(".htaccess: HSTS is disabled by default; confirm HTTPS readiness for all subdomains before enabling it");
}
if (headersCsp !== null && htaccessCsp !== null && headersCsp !== htaccessCsp) {
  problems.push("CSP mismatch: public/_headers and public/.htaccess declare different policies");
}
for (const [name, csp] of [["public/_headers", headersCsp], ["public/.htaccess", htaccessCsp]]) {
  if (csp !== null && !/connect-src\s+[^;]*https:\/\/bkohdqwecnvbmeaiuyyx\.supabase\.co/i.test(csp)) {
    problems.push(name + ": CSP connect-src must allow the Supabase project endpoint");
  }
}
for (const [name, csp] of [
  ["_headers", headersCsp],
  [".htaccess", htaccessCsp],
]) {
  if (csp !== null && /unsafe-inline|unsafe-eval/.test(csp)) {
    problems.push(`${name}: Content-Security-Policy must not contain unsafe-inline/unsafe-eval`);
  }
}

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const rel = file.slice(outDir.length + 1);

  if (!html.includes('href="/favicon.svg')) {
    problems.push(rel + ": the shared site favicon is missing");
  }
  if (/<[a-z][^>]*\sstyle\s*=/i.test(html)) {
    problems.push(rel + ": inline style attributes are blocked by the strict CSP; use a hashed style block");
  }

  if (["index.html", "blog/index.html", "Mian-e-Ma/index.html"].includes(rel) && !html.includes('src="/brand-logo.png?v=20261128-2"')) {
    problems.push(rel + ": the original brand logo image is missing from the header");
  }
  if (rel === "Mian-e-Ma/index.html") {
    const policies = [...html.matchAll(/<meta\b(?=[^>]*\bhttp-equiv=["']Content-Security-Policy["'])[^>]*>/gi)];
    if (policies.length !== 1) {
      problems.push("Mian-e-Ma/index.html: expected exactly one Content-Security-Policy meta tag");
    }
    if (!html.includes('href="/icon.png') || !html.includes('href="/apple-icon.png')) {
      problems.push("Mian-e-Ma/index.html: shared raster favicon variants must be used");
    }
  }

  const cspTag = html.match(/<meta\b(?=[^>]*\bhttp-equiv=["']Content-Security-Policy["'])[^>]*>/i)?.[0];
  const cspContent = cspTag?.match(/\bcontent="([^"]+)"/i)?.[1] ?? null;
  if (cspContent === null) {
    problems.push(rel + ": Content-Security-Policy meta tag is missing");
  } else if (/unsafe-inline|unsafe-eval/.test(cspContent)) {
    problems.push(rel + ": CSP meta must not allow unsafe-inline or unsafe-eval");
  }
  if ((rel === "admin/index.html" || rel === "admin/blog/index.html") &&
      !/connect-src\s+[^;]*https:\/\/bkohdqwecnvbmeaiuyyx\.supabase\.co/i.test(cspContent || "")) {
    problems.push(rel + ": CSP meta must allow the Supabase project endpoint");
  }

  for (const match of html.matchAll(/<script\b[^>]*>/g)) {
    const tag = match[0];
    const src = (tag.match(/\bsrc\s*=\s*["']([^"']+)["']/) || [])[1];
    if (src !== undefined) {
      if (src.includes("/_next/")) {
        problems.push(`${rel}: Next.js runtime script remains: ${src}`);
      } else {
        checkRef(rel, src, "script");
      }
    } else if (!/\btype\s*=\s*["']application\/ld\+json["']/.test(tag)) {
      problems.push(`${rel}: inline <script> without src (only JSON-LD data blocks are allowed)`);
    }
  }

  const refPatterns = [
    [/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/g, "anchor"],
    [/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/g, "link"],
    [/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/g, "img"],
    [/<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/g, "source"],
    [
      /<meta\b[^>]*\b(?:property|name)\s*=\s*["'](?:og:image|og:image:secure_url|twitter:image|og:url)["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/g,
      "meta",
    ],
    [
      /<meta\b[^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*\b(?:property|name)\s*=\s*["'](?:og:image|og:image:secure_url|twitter:image|og:url)["']/g,
      "meta",
    ],
  ];
  for (const [pattern, kind] of refPatterns) {
    for (const match of html.matchAll(pattern)) checkRef(rel, match[1], kind);
  }

  for (const match of html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)) {
    const digest = createHash("sha256").update(match[1], "utf8").digest("base64");
    const hash = `'sha256-${digest}'`;
    if (!headersRaw.includes(hash)) {
      problems.push(`${rel}: inline <style> present but its sha256 is not in _headers style-src`);
    }
    if (!htaccessRaw.includes(hash)) {
      problems.push(`${rel}: inline <style> present but its sha256 is not in .htaccess style-src`);
    }
    if (!cspContent || !cspContent.includes(hash)) {
      problems.push(`${rel}: inline <style> present but its sha256 is not in the page CSP meta style-src`);
    }
  }
}

const required = [
  "_headers",
  ".htaccess",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "index.html",
  "404.html",
  "boot.js",
  "ui.js",
  "favicon.svg",
  "brand-logo.png",
  "icon.png",
  "apple-icon.png",
  join("_hero", "hero-visual.js"),
  join("og", "og.jpg"),
  join("blog", "index.html"),
  join("blog", "feed.xml"),
  join("admin", "blog", "index.html"),
  join("admin", "blog", "blog.css"),
  join("admin", "blog", "app.js"),
  join("Mian-e-Ma", "index.html"),
  join("Mian-e-Ma", "styles.css"),
  join("Mian-e-Ma", "assets", "estedad-variable.woff2"),
  join("Mian-e-Ma", "assets", "mian-e-ma-cover-v2.webp"),
  join("Mian-e-Ma", "assets", "mian-e-ma-lineart.webp"),
  join("Mian-e-Ma", "assets", "mian-e-ma-social-preview.jpg"),
  join("Mian-e-Ma", "assets", "rexo-agency-logo-white.png"),
  join("Mian-e-Ma", "assets", "OFL.txt"),
];
for (const name of required) {
  if (!existsSync(join(outDir, name))) problems.push(`required file missing: ${name}`);
}

const duplicateBookPdf = join(outDir, "Mian-e-Ma", "assets", "Mian-e-Ma.pdf");
if (existsSync(duplicateBookPdf)) {
  problems.push("Mian-e-Ma/assets/Mian-e-Ma.pdf: remove the duplicate Pages copy; the canonical PDF is hosted on the tracked GitHub Release");
}

const heroChunksDir = join(outDir, "_hero", "chunks");
if (!existsSync(heroChunksDir) || !statSync(heroChunksDir).isDirectory()) {
  problems.push("_hero/chunks: split WebGL scene directory is missing");
} else {
  const heroChunks = readdirSync(heroChunksDir).filter((name) => name.endsWith(".js"));
  if (heroChunks.length === 0) {
    problems.push("_hero/chunks: no lazy Three.js scene chunk was emitted");
  } else {
    const heroEntry = readFileSync(join(outDir, "_hero", "hero-visual.js"), "utf8");
    const lazyImport = heroEntry.match(/import\(\s*["']\.\/chunks\/([^"']+\.js)["']\s*\)/);
    if (!lazyImport || !heroChunks.includes(lazyImport[1])) {
      problems.push("_hero/hero-visual.js: dynamic scene import does not resolve to an emitted chunk");
    }
  }
}

const blogPayloadPath = join(process.cwd(), ".cache", "blog-content.json");
let blogPayload = null;
if (existsSync(blogPayloadPath)) {
  try {
    blogPayload = JSON.parse(readFileSync(blogPayloadPath, "utf8"));
    if (!blogPayload || !Array.isArray(blogPayload.posts) || !blogPayload.settings) {
      problems.push(".cache/blog-content.json: unexpected published blog payload");
      blogPayload = null;
    }
  } catch (error) {
    problems.push(".cache/blog-content.json: invalid JSON (" + error.message + ")");
  }
} else {
  problems.push(".cache/blog-content.json: published payload is missing from the build");
}
const xmlEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[character]);
const robotsPath = join(outDir, "robots.txt");
if (existsSync(robotsPath) && siteOrigin) {
  const robotsText = readFileSync(robotsPath, "utf8");
  if (!robotsText.includes("Sitemap: " + siteOrigin + "/sitemap.xml")) {
    problems.push("robots.txt: the primary XML sitemap must be declared");
  }
  if (blogPayload?.settings?.enable_rss !== false &&
      !robotsText.includes("Sitemap: " + siteOrigin + "/blog/feed.xml")) {
    problems.push("robots.txt: the enabled RSS feed must be declared as an additional sitemap");
  }
}

const sitemapPath = join(outDir, "sitemap.xml");
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, "utf8");
  const bookUrl = siteOrigin ? siteOrigin + "/Mian-e-Ma/" : null;
  if (!sitemap.includes("<urlset") || !sitemap.includes("</urlset>")) {
    problems.push("sitemap.xml: invalid or incomplete urlset");
  }
  const locations = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  const hasLocation = (url) => locations.has(xmlEscape(url));
  if (bookUrl && !hasLocation(bookUrl)) {
    problems.push("sitemap.xml: the Persian book page is missing");
  }
  if (blogPayload && siteOrigin) {
    const settings = blogPayload.settings;
    if (settings.default_robots_index !== false) {
      const blogUrl = settings.canonical_url || siteOrigin + "/blog/";
      if (!hasLocation(blogUrl)) problems.push("sitemap.xml: the canonical blog archive is missing");
    }
    if (settings.sitemap_include_articles !== false && settings.default_robots_index !== false) {
      for (const post of blogPayload.posts) {
        if (!post?.slug || post.robots_index === false) continue;
        const url = post.canonical_url || siteOrigin + "/blog/" + post.slug + "/";
        if (!hasLocation(url)) problems.push("sitemap.xml: published article is missing: " + post.slug);
      }
    }
    if (settings.sitemap_include_categories !== false && settings.default_robots_index !== false) {
      const categoryCounts = new Map();
      for (const post of blogPayload.posts) {
        const slugs = Array.isArray(post.categories) && post.categories.length
          ? post.categories
          : [post.primary_category || post.category].filter(Boolean);
        for (const slug of slugs) categoryCounts.set(slug, (categoryCounts.get(slug) || 0) + 1);
      }
      const categories = new Map();
      for (const category of settings.categories || []) {
        if (category?.slug) categories.set(category.slug, category);
      }
      for (const slug of categoryCounts.keys()) {
        if (!categories.has(slug)) categories.set(slug, { slug });
      }
      for (const [slug] of categories) {
        const count = categoryCounts.get(slug) || 0;
        const seo = settings.category_seo?.[slug] || {};
        if (seo.robots_index === false || (settings.noindex_empty_categories !== false && count === 0)) continue;
        const url = seo.canonical_url || siteOrigin + "/blog/category/" + encodeURIComponent(slug) + "/";
        if (!hasLocation(url)) problems.push("sitemap.xml: indexable category is missing: " + slug);
      }
    }
  }
}
const rssPath = join(outDir, "blog", "feed.xml");
if (!existsSync(rssPath)) {
  problems.push("blog/feed.xml: RSS feed is missing from the export");
} else if (blogPayload && blogPayload.settings.enable_rss !== false) {
  const rss = readFileSync(rssPath, "utf8");
  if (!rss.includes("<rss") || !rss.includes("</rss>")) {
    problems.push("blog/feed.xml: RSS document is incomplete");
  }
  for (const post of blogPayload.posts) {
    if (!post?.slug) continue;
    const url = post.canonical_url || (siteOrigin || "https://ariakianzad.github.io") + "/blog/" + post.slug + "/";
    if (!rss.includes("<link>" + xmlEscape(url) + "</link>")) {
      problems.push("blog/feed.xml: published article link is missing: " + post.slug);
    }
    if (!rss.includes("<title>" + xmlEscape(post.title || "") + "</title>")) {
      problems.push("blog/feed.xml: published article title is missing: " + post.slug);
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  console.error(`export verification FAILED: ${problems.length} problem(s)`);
  process.exit(1);
}

console.log(
  `export verification passed: ${files.length} page(s), all referenced assets present, ` +
    `CSP invariants hold, all required files present`,
);
