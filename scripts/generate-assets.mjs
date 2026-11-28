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
const SOURCE_ICON_PATH = join(ROOT, "assets-src", "aria-kianzad-favicon.png");

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
/* Original logo artwork + browser/platform icon variants              */
/* ------------------------------------------------------------------ */

const sourceIcon = readFileSync(SOURCE_ICON_PATH);
const sourceMetadata = await sharp(sourceIcon).metadata();
if (sourceMetadata.format !== "png" || sourceMetadata.width !== 512 || sourceMetadata.height !== 512) {
  throw new Error("The canonical favicon source must be a 512x512 PNG.");
}

const sourceBase64 = sourceIcon.toString("base64");
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <image href="data:image/png;base64,${sourceBase64}" width="512" height="512" preserveAspectRatio="none"/>
</svg>`;

writeFileSync(join(ROOT, "public", "favicon.svg"), faviconSvg, "utf8");
await sharp(sourceIcon).png().toFile(join(ROOT, "src", "app", "icon.png"));
await sharp(sourceIcon)
  .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(join(ROOT, "src", "app", "apple-icon.png"));

console.log("Original Aria Kianzad logo generated as public/favicon.svg, 512px app icon and 180px Apple touch icon.");
