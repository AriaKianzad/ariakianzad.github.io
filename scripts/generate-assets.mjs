/**
 * Generates the site's bitmap assets from vendored, official sources:
 *
 *   assets-src/Estedad-Regular.ttf   (Estedad v8.5 static, official release)
 *   assets-src/Estedad-SemiBold.ttf  (Estedad v8.5 static, official release)
 *
 * Outputs (committed; re-run with `npm run assets` after editing):
 *   public/og/og.png        1200x630 social card
 *   src/app/icon.png        512x512 favicon
 *   src/app/apple-icon.png  180x180 apple touch icon
 *
 * Text is converted to SVG paths with opentype.js (Estedad glyph outlines),
 * so rendering never depends on system fonts being installed.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";
import wawoff2Module from "wawoff2";

const wawoff2 = wawoff2Module.default ?? wawoff2Module;

const ROOT = process.cwd();
const BG = "#0a0b0d";
const TEXT = "#f2f0ea";
const MUTED = "#a5a7ae";
const ACCENT = "#c7f36b";
const LINE = "#292d34";

const toBufferSource = (data) =>
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

const loadFont = (file) => opentype.parse(toBufferSource(readFileSync(join(ROOT, "assets-src", file))));

const regular = loadFont("Estedad-Regular.ttf");
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
/* Social card (1200x630)                                              */
/* ------------------------------------------------------------------ */

const W = 1200;
const H = 630;

const nameSize = 116;
const nameAdv = advance(semiBold, "Aria Kianzad", nameSize);
const nameX = (W - nameAdv) / 2;

const tagline = "Brand Strategist & Copywriter";
const taglineSize = 38;
const taglineAdv = advance(regular, tagline, taglineSize);
const taglineX = (W - taglineAdv) / 2;

const emailSize = 26;
const urlAdv = advance(regular, "ariakianzad.ir", emailSize);

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${BG}"/>
${textPath(semiBold, "Aria Kianzad", nameX, 300, nameSize, TEXT)}
<rect x="${(W - 84) / 2}" y="336" width="84" height="4" fill="${ACCENT}"/>
${textPath(regular, tagline, taglineX, 424, taglineSize, MUTED)}
<rect x="90" y="500" width="${W - 180}" height="1" fill="${LINE}"/>
${textPath(regular, "kianzadaria@gmail.com", 90, 556, emailSize, MUTED)}
${textPath(regular, "ariakianzad.ir", W - 90 - urlAdv, 556, emailSize, MUTED)}
</svg>`;

mkdirSync(join(ROOT, "public", "og"), { recursive: true });
await sharp(Buffer.from(ogSvg)).png().toFile(join(ROOT, "public", "og", "og.png"));
console.log("public/og/og.png written (1200x630)");

/* ------------------------------------------------------------------ */
/* Favicon + apple icon                                                */
/* ------------------------------------------------------------------ */

const iconSvg = (size) => {
  const markSize = size * 0.5;
  const text = "A.";
  const adv = advance(semiBold, text, markSize);
  const x = (size - adv) / 2;
  const y = size * 0.5 + markSize * 0.36;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${BG}"/>
${textPath(semiBold, text, x, y, markSize, ACCENT)}
</svg>`;
};

await sharp(Buffer.from(iconSvg(512))).png().toFile(join(ROOT, "src", "app", "icon.png"));
await sharp(Buffer.from(iconSvg(180))).png().toFile(join(ROOT, "src", "app", "apple-icon.png"));
console.log("src/app/icon.png (512) and src/app/apple-icon.png (180) written");
