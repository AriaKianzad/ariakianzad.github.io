/**
 * Deterministic extractor for vendored Simple Icons SVG files.
 * Each approved source must contain exactly one path. The output feeds icons.tsx.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "assets-src", "icons");
const target = join(process.cwd(), "src", "lib", "social-icons.json");
const expected = ["instagram", "linkedin", "medium", "unsplash", "x", "youtube"];
const files = readdirSync(dir).filter((file) => file.endsWith(".svg"));
const available = new Set(files.map((file) => file.replace(/\.svg$/, "")));
const missing = expected.filter((name) => !available.has(name));
if (missing.length) throw new Error("Missing icon source(s): " + missing.join(", "));

const out = {};
for (const name of expected) {
  const svg = readFileSync(join(dir, name + ".svg"), "utf8");
  if (/<script\b|<foreignObject\b|\bon[a-z]+\s*=/i.test(svg)) throw new Error("Unsafe SVG: " + name);
  const paths = [...svg.matchAll(/<path\b[^>]*\bd=["']([^"']+)["']/gi)];
  if (paths.length !== 1 || !paths[0][1].trim()) throw new Error("Expected one non-empty path in " + name + ".svg");
  out[name] = paths[0][1];
}

writeFileSync(target, JSON.stringify(out, null, 2) + "\n", "utf8");
for (const [name, path] of Object.entries(out)) console.log(name + ": " + path.length + " path characters");
