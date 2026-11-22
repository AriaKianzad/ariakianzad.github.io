import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [bundleBuilder, zipWriter, apache] = await Promise.all([
  read("scripts/make-hosting-bundle.mjs"),
  read("scripts/make-zip.ps1"),
  read("public/.htaccess"),
]);

assert.ok(bundleBuilder.includes("mkdtempSync(join(tmpdir(), \"aria-hosting-bundle-\"))"),
  "hosting staging must live inside a unique temporary workspace");
assert.ok(!/process\.env\.ARIA_HOSTING_(?:STAGING|EXTRACT)/.test(bundleBuilder),
  "hosting cleanup paths must not be controlled by user environment variables");
assert.ok(bundleBuilder.includes("lstatSync(path)") && bundleBuilder.includes("info.isSymbolicLink()"),
  "bundle collection must reject symlinks rather than follow them");
assert.ok(bundleBuilder.includes("entry.name.startsWith(\"/\")") &&
  bundleBuilder.includes('segment === ".."') &&
  bundleBuilder.includes("unixFileType === 0xa000"),
  "ZIP extraction must reject absolute/traversal paths and symlink entries");
assert.ok(bundleBuilder.includes("constants.COPYFILE_EXCL"),
  "the verified ZIP must be published without overwriting an existing archive");
assert.ok(!bundleBuilder.includes("rmSync(zipPath") &&
  !bundleBuilder.includes("rmSync(staging") &&
  !bundleBuilder.includes("rmSync(extract"),
  "the bundle builder must not delete pre-existing output or user-selected staging paths");
assert.ok(zipWriter.includes("Test-Path -LiteralPath $ZipPath") &&
  zipWriter.includes("Refusing to overwrite an existing archive"),
  "the PowerShell ZIP writer must independently refuse overwrites");

const expectedApacheRule = String.raw`  <FilesMatch "\.(css|woff2)$">`;
assert.ok(apache.includes(expectedApacheRule),
  "Apache CSS/font cache matcher must use a single regex escape before the dot");

console.log("Build safety contract passed: isolated staging, no symlink traversal, safe ZIP paths, exclusive archive output and Apache cache regex.");
