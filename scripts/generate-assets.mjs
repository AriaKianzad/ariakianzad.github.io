/**
 * Generates the shared brand favicon and Next.js raster icon variants.
 *
 * The vector source is committed at public/favicon.svg. The PNG files are
 * generated before dev/build and intentionally ignored by Git:
 *   src/app/icon.png        512x512 browser/Next.js icon
 *   src/app/apple-icon.png  180x180 Apple touch icon
 *
 * Text is converted to Estedad glyph paths with opentype.js, so raster
 * rendering never depends on system fonts being installed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";
import wawoff2Module from "wawoff2";

const wawoff2 = wawoff2Module.default ?? wawoff2Module;

const ROOT = process.cwd();
const PAPER = "#f3f0e8";
const PLUM = "#7b3f58";
const BRASS = "#d6a443";
const MARK = "#fbf9f4";

const toBufferSource = (data) =>
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

const loadFont = (file) => opentype.parse(toBufferSource(readFileSync(join(ROOT, "assets-src", file))));

const semiBold = loadFont("Estedad-SemiBold.ttf");

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
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const textPath = (font, text, x, y, size, fill) =>
  `<path d="${font.getPath(text, x, y, size).toPathData(2)}" fill="${fill}"/>`;

const advance = (font, text, size) => font.getAdvanceWidth(text, size);

/* ------------------------------------------------------------------ */
/* Favicon + apple icon                                                */
/* ------------------------------------------------------------------ */

const iconSvg = (size) => {
  const inset = size * 0.055;
  const tileSize = size - inset * 2;
  const markSize = size * 0.46;
  const mark = "AK";
  const markWidth = advance(semiBold, mark, markSize);
  const markX = (size - markWidth) / 2;
  const markY = size * 0.5 + markSize * 0.34;
  const cornerRadius = size * 0.18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${PAPER}"/>
<rect x="${inset}" y="${inset}" width="${tileSize}" height="${tileSize}" rx="${cornerRadius}" fill="${PLUM}"/>
${textPath(semiBold, mark, markX, markY, markSize, MARK)}
<circle cx="${size * 0.79}" cy="${size * 0.22}" r="${size * 0.045}" fill="${BRASS}"/>
</svg>`;
};

const vectorIcon = iconSvg(512);
writeFileSync(join(ROOT, "public", "favicon.svg"), vectorIcon, "utf8");
await sharp(Buffer.from(vectorIcon)).png().toFile(join(ROOT, "src", "app", "icon.png"));
await sharp(Buffer.from(iconSvg(180))).png().toFile(join(ROOT, "src", "app", "apple-icon.png"));
console.log("public/favicon.svg, src/app/icon.png (512), and src/app/apple-icon.png (180) generated");
