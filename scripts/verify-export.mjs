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
import { join } from "node:path";
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

/** Map an href/src/content reference to a path inside out/, or null if external. */
const toLocalPath = (ref) => {
  if (typeof ref !== "string" || ref.length === 0) return null;
  let path = null;
  if (ref.startsWith("/")) path = ref;
  else if (siteOrigin && ref.startsWith(siteOrigin)) path = ref.slice(siteOrigin.length);
  else return null;
  path = path.split("#")[0].split("?")[0];
  if (path === "" || path === "/") return "index.html";
  return path.replace(/^\/+/, "");
};

const checkRef = (rel, ref, kind) => {
  const local = toLocalPath(ref);
  if (local === null) return;
  if (!existsSync(join(outDir, local))) {
    problems.push(`${rel}: missing ${kind} target: ${ref}`);
  }
};

const headersRaw = existsSync(join(outDir, "_headers")) ? readFileSync(join(outDir, "_headers"), "utf8") : "";
const htaccessRaw = existsSync(join(outDir, ".htaccess")) ? readFileSync(join(outDir, ".htaccess"), "utf8") : "";

/* The CSP must be identical in both deployment configs and must never
   contain 'unsafe-inline'. */
const headersCsp = (headersRaw.match(/Content-Security-Policy:\s*(.+)/) || [])[1]?.trim() ?? null;
const htaccessCsp = (htaccessRaw.match(/Header\s+always\s+set\s+Content-Security-Policy\s+"([^"]+)"/) || [])[1] ?? null;
if (headersCsp === null) problems.push("_headers: no Content-Security-Policy directive found");
if (htaccessCsp === null) problems.push(".htaccess: no Content-Security-Policy header found");
if (headersCsp !== null && htaccessCsp !== null && headersCsp !== htaccessCsp) {
  problems.push("CSP mismatch: public/_headers and public/.htaccess declare different policies");
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
  join("og", "og.png"),
];
for (const name of required) {
  if (!existsSync(join(outDir, name))) problems.push(`required file missing: ${name}`);
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
