/**
 * Generates the shared brand favicon and Next.js raster icon variants.
 *
 * The vector source is committed at public/favicon.svg. The PNG files are
 * generated before dev/build and intentionally ignored by Git:
 *   src/app/icon.png        512x512 browser/Next.js icon
 *   src/app/apple-icon.png  180x180 Apple touch icon
 *
 * The compact AK monogram is drawn as vector geometry, so the icon
 * remains crisp at small sizes and does not depend on local system fonts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";
import wawoff2Module from "wawoff2";

const wawoff2 = wawoff2Module.default ?? wawoff2Module;

const ROOT = process.cwd();
const PLUM = "#7b3f58";
const BRASS = "#d6a443";
const MARK = "#fbf9f4";

const toBufferSource = (data) =>
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

/* ------------------------------------------------------------------ */
/* Verify the shipping web font before using it anywhere.              */
/* ------------------------------------------------------------------ */
const woff2 = readFileSync(join(ROOT, "src", "app", "fonts", "estedad-variable.woff2"));
const ttf = Buffer.from(await wawoff2.decompress(new Uint8Array(woff2)));
const vf = opentype.parse(toBufferSource(ttf));

const fvar = vf.tables && vf.tables.fvar;
const axes = ((fvar && fvar.axes) || []).map((axis) => `${axis.tag}:${axis.minValue}-${axis.maxValue}`);
console.log(`estedad-variable.woff2 fvar axes: ${axes.join(", ") || "none"}`);
if (!axes.includes("wght:100-900")) {
  throw new Error("wght axis must span 100-900; refusing to continue");
}

const sample = Array.from("AaBbGgKkRrZz0123456789&@?.!'-\u2019\u2013\u2026");
const missing = sample.filter((char) => {
  const glyph = vf.charToGlyph(char);
  return !glyph.name || glyph.name === ".notdef";
});
if (missing.length > 0) {
  throw new Error(`Missing Latin glyphs in Estedad woff2: ${missing.join(" ")}`);
}
console.log("wght axis and Latin coverage verified; generating assets");

/* ------------------------------------------------------------------ */
/* Shared vector favicon + raster platform variants                    */
/* ------------------------------------------------------------------ */

const iconSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<rect x="28" y="28" width="456" height="456" rx="92" fill="${PLUM}"/>
<g transform="translate(-26 24.5)">
  <path d="M150 365 220 148 292 365 M174 292H270 M322 148V365 M322 258 390 148 M322 258 394 365"
    fill="none" stroke="${MARK}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="408" cy="104" r="20" fill="${BRASS}"/>
</g>
</svg>`;

const vectorIcon = iconSvg(512);
writeFileSync(join(ROOT, "public", "favicon.svg"), vectorIcon, "utf8");
await sharp(Buffer.from(vectorIcon)).png().toFile(join(ROOT, "src", "app", "icon.png"));
await sharp(Buffer.from(iconSvg(180))).png().toFile(join(ROOT, "src", "app", "apple-icon.png"));
console.log("public/favicon.svg, src/app/icon.png (512), and src/app/apple-icon.png (180) generated");
