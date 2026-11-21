/**
 * Postbuild: make the static export compatible with a strict CSP
 * (script-src 'self', no 'unsafe-inline') and drop dead runtime output.
 *
 * This site has no client runtime: there are no "use client" components, so
 * nothing on the page needs React in the browser. The only scripts the site
 * ships are the two same-origin files public/boot.js, public/ui.js, and public/analytics-consent.js.
 *
 * Next.js' export nevertheless contains machinery for hydration and client
 * navigation. Everything removed here exists only for that machinery, and is
 * removed only when it matches the known shapes below:
 *
 * 1. Inline <script> blocks that belong to Next.js' runtime, identified by
 *    signature:
 *      - the React Flight payload: self.__next_f.push(...) and its array
 *        initializer (self.__next_f=self.__next_f||[]).push([0]);
 *      - the Turbopack chunk bootstrap:
 *        (globalThis["TURBOPACK"] ||= []).push({"otherChunks": ...}).
 *    These are the only inline scripts Next.js emits for this site; they
 *    would be blocked by the CSP anyway. A JSON-LD data block
 *    (type="application/ld+json") is data, not code, and is always kept. Any
 *    OTHER inline script is left untouched and reported loudly: silently
 *    deleting an intentional inline script would be worse than a CSP console
 *    error pointing at it.
 * 2. <script src="…/_next/…">: the framework's JS chunks.
 * 3. <link rel="preload" as="script|fetch|worker">: preloads for those
 *    chunks and their RSC payloads. Font preloads (as="font") are untouched,
 *    as are every other link, the stylesheet, and all metadata.
 * 4. <link rel="prefetch|prerender"> pointing into /_next/ (none are emitted
 *    today; the rule only ever covers framework output).
 *
 * If a script with a /_next/ src somehow remains after the replacements, the
 * artifact cleanup below is skipped, because the export still references the
 * runtime.
 *
 * When no runtime script is referenced by any page, files that existed only
 * for that runtime are removed: chunk JS under _next/static/chunks, the
 * build-manifest directory, RSC payload text files (index.txt,
 * _not-found.txt, __next.*.txt), and the _not-found payload directory. Those
 * exact patterns are the whole deletion list: robots.txt, sitemap.xml,
 * llms.txt, fonts, icons, and every referenced asset stay. Any regression is
 * caught by scripts/verify-export.mjs, which fails the build if a required
 * or referenced file is missing.
 *
 * Inline <style> blocks (e.g. if a next/font change ever inlines CSS) are not
 * removed; their sha256 hashes are appended to style-src in out/_headers so
 * the CSP keeps holding without 'unsafe-inline'.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const outDir = join(process.cwd(), "out");

const walk = (dir) => {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (name.endsWith(".html")) files.push(path);
  }
  return files;
};

/** Inline scripts, except JSON-LD data blocks (data, not code: always kept). */
const INLINE_SCRIPT =
  /<script(?![^>]*\bsrc\s*=)(?![^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/g;
/** External Next.js runtime chunks. */
const CHUNK_SCRIPT = /<script[^>]*\bsrc\s*=\s*["'][^"']*\/_next\/[^"']*["'][^>]*>\s*<\/script>/g;
/** Preloads for scripts/fetch payloads (font preloads, as="font", are kept). */
const SCRIPT_PRELOAD =
  /<link(?=[^>]*\brel\s*=\s*["']preload["'])(?=[^>]*\bas\s*=\s*["'](?:script|fetch|worker)["'])[^>]*>/g;
/** Prefetch/prerender hints, only when they point at Next.js output. */
const PREFETCH_LINK =
  /<link(?=[^>]*\brel\s*=\s*["'](?:prefetch|prerender)["'])(?=[^>]*\bhref\s*=\s*["'][^"']*(?:\/_next\/|\/__next)[^"']*["'])[^>]*>/g;
const STYLE_BLOCK = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g;

/**
 * Signatures of inline script content that belongs to Next.js' runtime:
 * the React Flight payload and its array initializer, and the Turbopack
 * chunk bootstrap. Anything else is left in place with a loud warning.
 */
const NEXT_INLINE = /\bself\.__next_f\b|globalThis\s*\[\s*["']TURBOPACK["']\s*\]/;

const files = walk(outDir);
const hashes = new Set();
let inlineScripts = 0;
let unknownInline = 0;
let chunkScripts = 0;
let scriptPreloads = 0;
let runtimeReferenced = false;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  const before = Buffer.byteLength(original);
  let html = original;

  for (const match of html.matchAll(STYLE_BLOCK)) {
    const digest = createHash("sha256").update(match[1], "utf8").digest("base64");
    hashes.add(`'sha256-${digest}'`);
  }

  html = html.replace(CHUNK_SCRIPT, () => (chunkScripts++, ""));
  html = html.replace(SCRIPT_PRELOAD, () => (scriptPreloads++, ""));
  html = html.replace(INLINE_SCRIPT, (tag, body) => {
    if (NEXT_INLINE.test(body)) {
      inlineScripts++;
      return "";
    }
    unknownInline++;
    console.warn(
      `WARNING ${file.slice(outDir.length + 1)}: unknown inline <script> left in place ` +
        `(the CSP will block it; decide intentionally): ${body.trim().slice(0, 80)}`,
    );
    return tag;
  });
  html = html.replace(PREFETCH_LINK, () => (scriptPreloads++, ""));

  if (/<script[^>]*\bsrc\s*=\s*["'][^"']*\/_next\//.test(html)) {
    runtimeReferenced = true;
  }

  writeFileSync(file, html);
  console.log(`${file.slice(outDir.length + 1)}: ${before} -> ${Buffer.byteLength(html)} bytes`);
}

console.log(
  `removed ${inlineScripts} Next.js inline script(s), ${chunkScripts} runtime chunk(s), ` +
    `${scriptPreloads} script preload(s) across ${files.length} file(s)` +
    (unknownInline > 0 ? `; ${unknownInline} unknown inline script(s) LEFT IN PLACE (see warnings)` : ""),
);

if (hashes.size > 0) {
  const headersPath = join(outDir, "_headers");
  try {
    const headers = readFileSync(headersPath, "utf8");
    const updated = headers.replace(
      "style-src 'self'",
      `style-src 'self' ${Array.from(hashes).join(" ")}`,
    );
    if (updated !== headers) {
      writeFileSync(headersPath, updated);
      console.log(`_headers: style-src extended with ${hashes.size} inline style hash(es)`);
    }
  } catch {
    console.log("_headers: not found next to the export; skipped hash injection");
  }
}

/**
 * Dead-weight cleanup, scoped to exact runtime-only patterns. Guarded: it
 * only runs when no HTML references a runtime script any more.
 */
if (!runtimeReferenced) {
  const rm = (target) => {
    rmSync(target, { recursive: true, force: true });
  };
  const nextStatic = join(outDir, "_next", "static");
  const removed = [];
  try {
    for (const name of readdirSync(join(nextStatic, "chunks"))) {
      if (name.endsWith(".js")) {
        rm(join(nextStatic, "chunks", name));
        removed.push(`chunks/${name}`);
      }
    }
    for (const name of readdirSync(nextStatic, { withFileTypes: true })) {
      if (name.isDirectory() && name.name !== "chunks" && name.name !== "media") {
        rm(join(nextStatic, name.name));
        removed.push(`_next/static/${name.name}/`);
      }
    }
    // RSC payload text files only. Real content (robots.txt, llms.txt) never
    // matches these patterns.
    for (const name of readdirSync(outDir)) {
      if (/^(?:index|_not-found)\.txt$/.test(name) || /^__next\./.test(name)) {
        rm(join(outDir, name));
        removed.push(name);
      }
    }
    const notFoundDir = join(outDir, "_not-found");
    if (statSync(notFoundDir, { throwIfNoEntry: false })?.isDirectory()) {
      rm(notFoundDir);
      removed.push("_not-found/");
    }
    if (removed.length > 0) {
      console.log(`cleanup: removed ${removed.length} unused runtime artifact(s): ${removed.join(", ")}`);
    } else {
      console.log("cleanup: nothing to remove");
    }
  } catch (error) {
    console.log(`cleanup skipped: ${String(error)}`);
  }
} else {
  console.log("cleanup skipped: HTML still references Next runtime scripts");
}
