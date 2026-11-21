/**
 * Build the cPanel hosting bundle from the FINAL production export.
 *
 * Prerequisite: `npm run build` must have completed successfully (out/ is
 * the artifact). Deployable content comes ONLY from out/, plus the font
 * licenses and the hosting guide from the repository.
 *
 * What lands in hosting-bundle.zip (all at archive ROOT - extracting into
 * the document root yields a working site immediately):
 *
 *   - everything in out/ EXCEPT _not-found.html (Next.js' internal
 *     not-found payload; the classic custom error page is 404.html,
 *     which .htaccess wires up via ErrorDocument). _headers is INCLUDED:
 *     inert on Apache but it carries the identical headers for a later
 *     move to a Netlify/Cloudflare Pages-style host.
 *   - licenses/ <- LICENSES/ (SIL OFL 1.1 for Estedad + Geist Mono)
 *   - HOSTING-README.txt <- hosting/HOSTING-README.txt
 *
 * ZIP writer: the Windows-native .NET ZipArchive (scripts/make-zip.ps1),
 * with entry names written explicitly with forward slashes - parsed
 * correctly by Windows Explorer, Linux unzip, and cPanel File Manager.
 * bsdtar's zip writer is deliberately not used: its archives are valid
 * but documented to render as EMPTY in Windows Explorer
 * (libarchive/libarchive#2489), which caused a false "empty archive"
 * report for an earlier bundle.
 *
 * This command is fail-safe: it exits 1 unless EVERY validation passes.
 * A zero-byte zip, an invalid structure, a missing entry, a hash
 * mismatch, or a failing extracted-site smoke test can never produce a
 * success message or exit code 0.
 *
 *   1. out/ has index.html, .htaccess, 404.html; staging matches out/
 *      (minus _not-found.html), plus licenses/ and HOSTING-README.txt
 *   2. Node-side structural parse (EOCD + central directory): entry
 *      names use forward slashes only, sizes match staging
 *      byte-for-byte, root-level index.html/.htaccess, no duplicate,
 *      encrypted, or forbidden (development-artifact) entries
 *   3. independent listing by bsdtar (-tf) equals the parsed entries
 *   4. independent .NET read (scripts/inspect-zip.ps1) equals counts,
 *      uncompressed total, and confirms root-level index.html/.htaccess
 *   5. extraction by bsdtar (-xf) into a clean directory; every file
 *      SHA-256-equal to its staged counterpart
 *   6. HTTP smoke test: the extracted site is served on an ephemeral
 *      port; every asset referenced by index.html plus robots/sitemap/
 *      llms/og must respond 200 with a plausible content type, an
 *      unknown path must respond 404
 *
 * Usage: node scripts/make-hosting-bundle.mjs
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import http from "node:http";

const repoRoot = process.cwd();
const outDir = join(repoRoot, "out");
const zipPath = join(repoRoot, "hosting-bundle.zip");
const staging = process.env.ARIA_HOSTING_STAGING || join(tmpdir(), "aria-hosting-bundle-staging");
const extract = process.env.ARIA_HOSTING_EXTRACT || join(tmpdir(), "aria-hosting-bundle-extract");

const REQUIRED = [
  "index.html",
  "404.html",
  ".htaccess",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "boot.js",
  "ui.js",
  "_hero/hero-visual.js",
  "icon.png",
  "apple-icon.png",
  "og/og.png",
  "HOSTING-README.txt",
  "licenses/OFL-Estedad.txt",
  "licenses/OFL-GeistMono.txt",
  "Mian-e-Ma/index.html",
  "Mian-e-Ma/styles.css",
  "Mian-e-Ma/assets/Mian-e-Ma.pdf",
  "Mian-e-Ma/assets/estedad-variable.woff2",
  "Mian-e-Ma/assets/mian-e-ma-cover-v2.webp",
  "Mian-e-Ma/assets/mian-e-ma-lineart.webp",
  "Mian-e-Ma/assets/rexo-agency-logo-white.png",
  "Mian-e-Ma/assets/OFL.txt",
];
const FORBIDDEN = [
  "node_modules/", ".git/", ".next/", "out/", "dist/", "hosting-bundle/",
  "src/", "scripts/", "assets-src/", ".env",
];

const problems = [];
const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};
const isForbidden = (name) =>
  FORBIDDEN.some((f) => name === f || name.startsWith(f.endsWith("/") ? f : `${f}/`) ||
    (f === ".env" && name.startsWith(".env")));

const collect = (dir) => {
  const map = new Map(); // relative name -> { size, sha256 }
  const walk = (current, prefix) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) {
        walk(path, `${prefix}${name}/`);
      } else {
        const bytes = readFileSync(path);
        map.set(`${prefix}${name}`, {
          size: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  };
  walk(dir, "");
  return map;
};

/* Node-side structural parse; no dependencies. Standard zip (not Zip64). */
const parseCentralDirectory = (buffer) => {
  let eocd = -1;
  const searchStart = Math.max(0, buffer.length - 22 - 65535);
  for (let i = buffer.length - 22; i >= searchStart; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("end-of-central-directory record not found");
  const count = buffer.readUInt16LE(eocd + 10);
  const cdSize = buffer.readUInt32LE(eocd + 12);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    throw new Error("Zip64 archive unexpected for this bundle");
  }
  const entries = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) {
      throw new Error(`central directory entry ${n}: bad signature`);
    }
    entries.push({
      name: buffer.toString("utf8", p + 46, p + 46 + buffer.readUInt16LE(p + 28)),
      flags: buffer.readUInt16LE(p + 8),
      compressed: buffer.readUInt32LE(p + 20),
      uncompressed: buffer.readUInt32LE(p + 24),
      extraLen: buffer.readUInt16LE(p + 30),
      commentLen: buffer.readUInt16LE(p + 32),
    });
    p += 46 + entries[n].name.length + entries[n].extraLen + entries[n].commentLen;
  }
  if (p - cdOffset !== cdSize) {
    throw new Error(`central directory size mismatch: walked ${p - cdOffset}, EOCD declares ${cdSize}`);
  }
  return entries;
};

async function main() {
  if (!existsSync(join(outDir, "index.html"))) {
    fail("out/index.html not found - run `npm run build` first");
  }
  if (!existsSync(join(outDir, ".htaccess"))) {
    fail("out/.htaccess not found - public/.htaccess should be copied into out/ by the build");
  }
  if (!existsSync(join(outDir, "404.html"))) {
    fail("out/404.html not found - run `npm run build` first");
  }

  /* Stage. */
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  for (const name of readdirSync(outDir)) {
    if (name === "_not-found.html") continue; // internal Next.js payload, not deployable
    cpSync(join(outDir, name), join(staging, name), { recursive: true });
  }
  cpSync(join(repoRoot, "LICENSES"), join(staging, "licenses"), { recursive: true });
  cpSync(join(repoRoot, "hosting", "HOSTING-README.txt"), join(staging, "HOSTING-README.txt"));
  const staged = collect(staging);
  const stagedBytes = [...staged.values()].reduce((sum, f) => sum + f.size, 0);

  /* Zip with the Windows-native .NET writer. */
  rmSync(zipPath, { force: true });
  const psExe = join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  execFileSync(psExe, [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
    join(repoRoot, "scripts", "make-zip.ps1"),
    "-Staging", staging, "-ZipPath", zipPath,
  ], { stdio: "inherit" });
  if (!existsSync(zipPath)) fail("zip was not produced");
  const buffer = readFileSync(zipPath);
  if (buffer.length < 1000) problems.push(`zip suspiciously small (${buffer.length} bytes)`);

  /* 1. Structural parse in Node. */
  let entries;
  try {
    entries = parseCentralDirectory(buffer);
  } catch (error) {
    fail(`zip structure invalid: ${error.message}`);
  }
  const fileEntries = entries.filter((e) => !e.name.endsWith("/"));
  const dirEntries = entries.filter((e) => e.name.endsWith("/"));
  for (const entry of entries) {
    if (entry.name.includes("\\")) problems.push(`entry uses backslash separators: ${entry.name}`);
    if (entry.flags & 0x1) problems.push(`entry is encrypted: ${entry.name}`);
  }
  const names = new Set(fileEntries.map((e) => e.name));
  if (fileEntries.length !== staged.size) {
    problems.push(`file count mismatch: archive ${fileEntries.length}, staging ${staged.size}`);
  }
  const uncompressedTotal = fileEntries.reduce((sum, e) => sum + e.uncompressed, 0);
  const compressedTotal = fileEntries.reduce((sum, e) => sum + e.compressed, 0);
  for (const entry of fileEntries) {
    const source = staged.get(entry.name);
    if (!source) {
      problems.push(`archive contains an entry not in staging: ${entry.name}`);
    } else if (entry.uncompressed !== source.size) {
      problems.push(`size mismatch for ${entry.name}: archive ${entry.uncompressed}, staging ${source.size}`);
    }
  }
  for (const name of staged.keys()) {
    if (!names.has(name)) problems.push(`staged file missing from archive: ${name}`);
  }
  for (const required of REQUIRED) {
    if (!names.has(required)) problems.push(`missing at archive root: ${required}`);
  }
  for (const name of names) {
    if (isForbidden(name)) problems.push(`development artifact inside archive: ${name}`);
  }
  if (uncompressedTotal !== stagedBytes) {
    problems.push(`uncompressed total mismatch: archive ${uncompressedTotal}, staging ${stagedBytes}`);
  }

  /* 2. Independent bsdtar listing. */
  const tarNames = new Set(
    execFileSync("tar.exe", ["-tf", zipPath], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.replace(/^\.\//, "").replace(/\/$/, ""))
      .filter((line) => line !== "")
  );
  if (tarNames.size !== names.size || [...names].some((n) => !tarNames.has(n))) {
    problems.push("bsdtar listing disagrees with the parsed central directory");
  }

  /* 3. Independent .NET read. */
  const dotnetJson = execFileSync(psExe, [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
    join(repoRoot, "scripts", "inspect-zip.ps1"), "-ZipPath", zipPath,
  ], { encoding: "utf8" }).trim().split(/\r?\n/).pop();
  const dotnet = JSON.parse(dotnetJson);
  if (dotnet.files !== fileEntries.length) problems.push(".NET read disagrees on file count");
  if (dotnet.uncompressed !== uncompressedTotal) problems.push(".NET read disagrees on uncompressed total");
  if (!dotnet.hasIndex || !dotnet.hasHtaccess) {
    problems.push(".NET read did not confirm root-level index.html/.htaccess");
  }

  /* 4. Extraction into a clean directory, byte-for-byte compare. */
  rmSync(extract, { recursive: true, force: true });
  mkdirSync(extract, { recursive: true });
  execFileSync("tar.exe", ["-xf", zipPath, "-C", extract], { stdio: "pipe" });
  const extracted = collect(extract);
  if (extracted.size !== staged.size) {
    problems.push(`extracted file count ${extracted.size} != staged ${staged.size}`);
  }
  for (const [name, source] of staged) {
    const copy = extracted.get(name);
    if (!copy) {
      problems.push(`not extracted: ${name}`);
    } else if (copy.sha256 !== source.sha256) {
      problems.push(`SHA-256 mismatch after extraction: ${name}`);
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    fail("hosting bundle verification FAILED");
  }

  /* 5. HTTP smoke test of the extracted site. */
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml",
    ".pdf": "application/pdf",
    ".webp": "image/webp",
  };
  const extractRoot = resolve(extract);
  const insideExtract = (candidate) => {
    const rel = relative(extractRoot, candidate);
    return rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel));
  };

  const server = http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD", "X-Content-Type-Options": "nosniff" });
      res.end(req.method === "HEAD" ? undefined : "Method not allowed");
      return;
    }
    try {
      const rawPath = new URL(req.url || "/", "http://127.0.0.1").pathname;
      const pathname = decodeURIComponent(rawPath);
      if (pathname.includes("\0") || pathname.includes("\\")) {
        res.writeHead(400, { "X-Content-Type-Options": "nosniff" });
        res.end(req.method === "HEAD" ? undefined : "Invalid path");
        return;
      }

      let resolved = resolve(extractRoot, "." + (pathname.startsWith("/") ? pathname : "/" + pathname));
      if (!insideExtract(resolved)) {
        res.writeHead(403, { "X-Content-Type-Options": "nosniff" });
        res.end(req.method === "HEAD" ? undefined : "Forbidden");
        return;
      }
      if (existsSync(resolved) && statSync(resolved).isDirectory()) {
        resolved = join(resolved, "index.html");
      } else if (!existsSync(resolved) && existsSync(resolved + ".html")) {
        resolved += ".html";
      }

      if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        const notFound = join(extractRoot, "404.html");
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff" });
        res.end(req.method === "HEAD" ? undefined : (existsSync(notFound) ? readFileSync(notFound) : "404"));
        return;
      }

      const realFile = realpathSync(resolved);
      if (!insideExtract(realFile)) {
        res.writeHead(403, { "X-Content-Type-Options": "nosniff" });
        res.end(req.method === "HEAD" ? undefined : "Forbidden");
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[extname(realFile).toLowerCase()] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : readFileSync(realFile));
    } catch (error) {
      const status = error instanceof URIError ? 400 : 500;
      res.writeHead(status, { "X-Content-Type-Options": "nosniff" });
      res.end(req.method === "HEAD" ? undefined : "Request failed");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const smoke = [];
  const get = async (path) => {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, type: res.headers.get("content-type") || "", body: Buffer.from(await res.arrayBuffer()) };
  };

  const home = await get("/");
  const text = home.body.toString("utf8");
  if (home.status !== 200) smoke.push(`GET / -> ${home.status}`);
  if (!home.type.startsWith("text/html")) smoke.push(`GET / content-type ${home.type}`);
  for (const marker of ["<h1", "ariakianzad.ir", "application/ld+json", "kianzadaria@gmail.com"]) {
    if (!text.includes(marker)) smoke.push(`homepage missing: ${marker}`);
  }
  if (!text.toLowerCase().includes("estedad")) smoke.push("homepage missing: estedad font reference");
  if (text.includes("localhost")) smoke.push("homepage contains a development URL");

  /* Verify the hero entrypoint and its code-split Three.js chunk. */
  const heroModule = await get("/_hero/hero-visual.js");
  if (heroModule.status !== 200 || !heroModule.type.startsWith("text/javascript")) {
    smoke.push("GET /_hero/hero-visual.js did not return the hero module");
  } else {
    const heroCode = heroModule.body.toString("utf8");
    const heroChunkNames = readdirSync(join(extractRoot, "_hero", "chunks")).filter((name) => name.endsWith(".js"));
    const referencedChunk = heroChunkNames.find((name) => heroCode.includes(name));
    if (!referencedChunk) {
      smoke.push("hero module does not reference an emitted Three.js chunk");
    } else {
      const chunk = await get("/_hero/chunks/" + referencedChunk);
      if (chunk.status !== 200 || !chunk.type.startsWith("text/javascript")) {
        smoke.push("GET /_hero/chunks/" + referencedChunk + " did not return JavaScript");
      }
    }
  }

  /* Every local asset referenced by index.html must resolve. */
  const refs = new Set();
  for (const match of text.matchAll(/(?:href|src)="(\/[^"?#]+)"/g)) refs.add(match[1]);
  for (const ref of refs) {
    const res = await get(ref);
    if (res.status !== 200) {
      smoke.push(`GET ${ref} -> ${res.status}`);
    } else {
      const expected = {
        ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2",
        ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml",
      }[extname(new URL(ref, base).pathname).toLowerCase()];
      const type = res.type.split(";")[0];
      if (expected && type !== expected) smoke.push(`GET ${ref} content-type ${type}, expected ${expected}`);
    }
  }

  for (const [path, marker] of [
    ["/robots.txt", "Sitemap"],
    ["/sitemap.xml", "<urlset"],
    ["/llms.txt", "ariakianzad.ir"],
    ["/og/og.png", null],
    ["/404.html", null],
  ]) {
    const res = await get(path);
    if (res.status !== 200) {
      smoke.push(`GET ${path} -> ${res.status}`);
    } else if (marker && !res.body.toString("utf8").includes(marker)) {
      smoke.push(`GET ${path} missing marker: ${marker}`);
    }
  }
  const bookPage = await get("/Mian-e-Ma/");
  const bookHtml = bookPage.body.toString("utf8");
  if (bookPage.status !== 200 || !bookHtml.includes("میانِ ما")) {
    smoke.push("GET /Mian-e-Ma/ did not return the Persian book page");
  }

  const bookRefs = new Set();
  for (const match of bookHtml.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = new URL(match[1], base + "/Mian-e-Ma/");
    if (url.origin === base) bookRefs.add(url.pathname);
  }
  for (const ref of bookRefs) {
    const res = await get(ref);
    if (res.status !== 200) {
      smoke.push("GET " + ref + " -> " + res.status);
      continue;
    }
    const expected = {
      ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2",
      ".png": "image/png", ".pdf": "application/pdf", ".webp": "image/webp",
    }[extname(new URL(ref, base).pathname).toLowerCase()];
    const type = res.type.split(";")[0];
    if (expected && type !== expected) {
      smoke.push("GET " + ref + " content-type " + type + ", expected " + expected);
    }
    if (ref.endsWith("/Mian-e-Ma/assets/Mian-e-Ma.pdf") &&
        res.body.subarray(0, 5).toString("ascii") !== "%PDF-") {
      smoke.push("Book PDF does not have a valid PDF signature");
    }
  }

  const unknown = await get("/definitely-missing-404-test");
  if (unknown.status !== 404) smoke.push(`unknown path returned ${unknown.status}, expected 404`);

  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  if (smoke.length > 0) {
    for (const s of smoke) console.error(`✗ smoke test: ${s}`);
    fail("extracted-site smoke test FAILED");
  }

  console.log(`hosting bundle OK: ${zipPath}`);
  console.log(`  zip size: ${buffer.length} bytes`);
  console.log(`  entries: ${fileEntries.length} files, ${dirEntries.length} directory records`);
  console.log(`  uncompressed: ${uncompressedTotal} bytes (compressed: ${compressedTotal} bytes)`);
  console.log(`  root-level index.html and .htaccess confirmed; no nesting, no dev artifacts`);
  console.log(`  extraction: ${extracted.size}/${staged.size} files SHA-256-identical to staging`);
  console.log(`  HTTP smoke test: homepage, ${refs.size} referenced assets, SEO files, 404 handling`);
}

main().catch((error) => {
  console.error(`✗ hosting bundle build failed: ${error.message}`);
  process.exit(1);
});
