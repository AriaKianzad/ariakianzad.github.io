/**
 * One-off (rerunnable) extractor: reads the vendored Simple Icons SVGs in
 * assets-src/icons/ and writes their path geometry to src/lib/social-icons.json
 * for src/components/icons.tsx. Run: node scripts/extract-social-paths.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "assets-src", "icons");
const out = {};
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".svg")) continue;
  const svg = readFileSync(join(dir, file), "utf8");
  const match = svg.match(/\bd="([^"]+)"/);
  out[file.replace(/\.svg$/, "")] = match ? match[1] : null;
}
const target = join(process.cwd(), "src", "lib", "social-icons.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
for (const [key, value] of Object.entries(out)) {
  console.log(`${key}: ${value ? `${value.length} chars` : "MISSING"}`);
}
