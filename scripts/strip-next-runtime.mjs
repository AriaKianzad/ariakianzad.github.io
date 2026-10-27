/**
 * Postbuild: make the static export compatible with a strict CSP
 * (script-src 'self', no 'unsafe-inline') and remove dead weight.
 *
 * The site ships zero Next.js client runtime: all pages are static server
 * output plus public/boot.js and public/ui.js. Next's export, however, still
 * emits inline runtime scripts, chunk <script> tags, and script preloads.
 * This script removes them from every exported .html file, then appends the
 * sha256 hashes of any remaining inline <style> blocks (the next/font face
 * rules) to the style-src directive in out/_headers, so inline font CSS
 * stays allowed without relaxing the CSP.
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

/** Inline scripts, except JSON-LD data blocks (never executed, CSP-exempt). */
const INLINE_SCRIPT =
  /<script(?![^>]*\bsrc\s*=)(?![^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/g;
/** External Next.js runtime chunks. */
const CHUNK_SCRIPT = /<script[^>]*\bsrc\s*=\s*["'][^"']*\/_next\/[^"']*["'][^>]*>\s*<\/script>/g;
/** Preloads for scripts/fetch payloads (font preloads, as="font", are kept). */
const SCRIPT_PRELOAD =
  /<link(?=[^>]*\brel\s*=\s*["']preload["'])(?=[^>]*\bas\s*=\s*["'](?:script|fetch|worker)["'])[^>]*>/g;
const PREFETCH_LINK = /<link(?=[^>]*\brel\s*=\s*["'](?:prefetch|prerender)["'])[^>]*>/g;
const STYLE_BLOCK = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g;

const files = walk(outDir);
const hashes = new Set();
let inlineScripts = 0;
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
  html = html.replace(INLINE_SCRIPT, () => (inlineScripts++, ""));
  html = html.replace(SCRIPT_PRELOAD, () => (scriptPreloads++, ""));
  html = html.replace(PREFETCH_LINK, () => (scriptPreloads++, ""));

  if (/<script[^>]*\bsrc\s*=\s*["'][^"']*\/_next\//.test(html)) {
    runtimeReferenced = true;
  }

  writeFileSync(file, html);
  console.log(`${file.slice(outDir.length + 1)}: ${before} -> ${Buffer.byteLength(html)} bytes`);
}

console.log(
  `removed ${inlineScripts} inline script(s), ${chunkScripts} runtime chunk(s), ${scriptPreloads} script preload(s) across ${files.length} file(s)`,
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
 * Dead-weight cleanup. With no runtime script referenced by any page, the
 * Next.js chunk JS, the build manifests, and the RSC payload text files can
 * never be fetched. The stylesheet and /_next/static/media (fonts, icons)
 * are referenced by the HTML and stay. llms.txt is real content and stays.
 */
if (!runtimeReferenced) {
  const rm = (target) => {
    rmSync(target, { recursive: true, force: true });
  };
  const nextStatic = join(outDir, "_next", "static");
  let removed = 0;
  try {
    for (const name of readdirSync(join(outDir, "_next", "static", "chunks"))) {
      if (name.endsWith(".js")) { rm(join(nextStatic, "chunks", name)); removed++; }
    }
    for (const name of readdirSync(nextStatic, { withFileTypes: true })) {
      if (name.isDirectory() && name.name !== "chunks" && name.name !== "media") {
        rm(join(nextStatic, name.name));
        removed++;
      }
    }
    for (const name of readdirSync(outDir)) {
      if (name.endsWith(".txt") && name !== "llms.txt") { rm(join(outDir, name)); removed++; }
    }
    const notFoundDir = join(outDir, "_not-found");
    if (statSync(notFoundDir, { throwIfNoEntry: false })?.isDirectory()) {
      rm(notFoundDir);
      removed++;
    }
    console.log(`cleanup: removed ${removed} unused runtime artifact(s)`);
  } catch (error) {
    console.log(`cleanup skipped: ${String(error)}`);
  }
} else {
  console.log("cleanup skipped: HTML still references Next runtime scripts");
}
