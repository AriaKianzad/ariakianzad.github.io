/**
 * Build the cPanel hosting bundle from the FINAL production export.
 *
 * Prerequisite: `npm run build` must have completed successfully (out/ is
 * the artifact). This script never reads source files for the deployable
 * content - everything comes from out/, plus the font licenses and the
 * hosting guide from the repository.
 *
 * What lands in hosting-bundle.zip (all at archive ROOT - extracting into
 * the document root yields a working site immediately):
 *
 *   - everything in out/ EXCEPT _not-found.html (Next.js' internal
 *     not-found payload; the classic custom error page is 404.html, which
 *     .htaccess wires up via ErrorDocument). _headers is INCLUDED: inert
 *     on Apache but it carries the identical headers for a later move to
 *     a Netlify/Cloudflare Pages-style host.
 *   - licenses/ <- LICENSES/ (SIL OFL 1.1 for Estedad + Geist Mono)
 *   - HOSTING-README.txt <- hosting/HOSTING-README.txt
 *
 * The ZIP is written with bsdtar (ships with Windows; zip format selected
 * explicitly) and then verified: entry list must show root-level
 * index.html and .htaccess, must NOT nest the site under any parent
 * folder, and must contain no development artifacts. Exits 1 on any
 * violation.
 *
 * Usage: node scripts/make-hosting-bundle.mjs
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = process.cwd();
const outDir = join(repoRoot, "out");
const zipPath = join(repoRoot, "hosting-bundle.zip");
const staging = process.env.ARIA_HOSTING_STAGING || join(tmpdir(), "aria-hosting-bundle-staging");

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

if (!existsSync(join(outDir, "index.html"))) {
  fail("out/index.html not found - run `npm run build` first");
}
if (!existsSync(join(outDir, ".htaccess"))) {
  fail("out/.htaccess not found - public/.htaccess should be copied into out/ by the build");
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

/* Zip (bsdtar; explicit zip format). */
rmSync(zipPath, { force: true });
execFileSync("tar.exe", ["--format=zip", "-cf", zipPath, "-C", staging, "."], { stdio: "inherit" });
if (!existsSync(zipPath)) fail("tar.exe did not produce hosting-bundle.zip");

/* Verify the archive. */
const listing = execFileSync("tar.exe", ["-tf", zipPath], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((line) => line.replace(/^\.\//, "").replace(/\/$/, ""))
  .filter((line) => line !== "");

const problems = [];
const has = (name) => listing.some((entry) => entry === name || entry.startsWith(`${name}/`));
for (const required of [
  "index.html",
  "404.html",
  ".htaccess",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "boot.js",
  "ui.js",
  "icon.png",
  "apple-icon.png",
  "og/og.png",
  "HOSTING-README.txt",
  "licenses/OFL-Estedad.txt",
  "licenses/OFL-GeistMono.txt",
]) {
  if (!has(required)) problems.push(`missing: ${required}`);
}
for (const forbidden of ["node_modules", ".git", ".env", "out/", "hosting-bundle/", "src/", "scripts/", ".next"]) {
  if (listing.some((entry) => entry === forbidden || entry.startsWith(`${forbidden}/`))) {
    problems.push(`development artifact inside archive: ${forbidden}`);
  }
}
if (!listing.some((entry) => entry === "index.html")) {
  problems.push("index.html is not at the archive root (site would be nested)");
}
if (!listing.some((entry) => entry === ".htaccess")) {
  problems.push(".htaccess is not at the archive root (hidden-file omission?)");
}

const files = [];
const dirs = [];
const walkStaging = (dir, prefix) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      dirs.push(prefix + name);
      walkStaging(path, `${prefix}${name}/`);
    } else {
      files.push(prefix + name);
    }
  }
};
walkStaging(staging, "");

if (problems.length > 0) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  fail("hosting bundle verification FAILED");
}

console.log(`hosting bundle OK: ${zipPath}`);
console.log(`  files: ${files.length}, directories: ${dirs.length}`);
console.log(`  root-level index.html and .htaccess confirmed; no nesting, no dev artifacts`);
