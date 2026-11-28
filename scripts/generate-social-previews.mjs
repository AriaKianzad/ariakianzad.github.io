import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const outputRoot = join(root, "out");
const width = 1200;
const height = 630;

// Load Estedad as real font files. SVG @font-face data URIs are ignored by
// librsvg (the SVG renderer bundled with sharp), so use resvg's explicit font
// database to keep Persian text from silently falling back to a system font.
const estedadFontFiles = [
  join(root, "assets-src/Estedad-Regular.ttf"),
  join(root, "assets-src/Estedad-SemiBold.ttf"),
];

const renderSvg = (svg) =>
  new Resvg(svg, {
    font: {
      fontFiles: estedadFontFiles,
      loadSystemFonts: true,
    },
    textRendering: 1,
  }).render().asPng();

const homepageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FBFBF7"/>
      <stop offset="0.6" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#F0E8EB"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="#E3B72F" stop-opacity=".32"/>
      <stop offset=".28" stop-color="#782C44" stop-opacity=".12"/>
      <stop offset="1" stop-color="#782C44" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse">
      <path d="M72 0H0V72" fill="none" stroke="#782C44" stroke-opacity=".055" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#background)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect x="54" y="48" width="1092" height="534" rx="4" fill="none" stroke="#782C44" stroke-opacity=".34"/>
  <g opacity=".9">
    <circle cx="850" cy="315" r="232" fill="url(#glow)"/>
    <circle cx="850" cy="315" r="204" fill="none" stroke="#782C44" stroke-opacity=".35" stroke-width="1.4"/>
    <ellipse cx="850" cy="315" rx="310" ry="105" transform="rotate(-9 850 315)" fill="none" stroke="#782C44" stroke-opacity=".40"/>
    <ellipse cx="850" cy="315" rx="260" ry="154" transform="rotate(22 850 315)" fill="none" stroke="#782C44" stroke-opacity=".26"/>
    <ellipse cx="850" cy="315" rx="115" ry="265" transform="rotate(4 850 315)" fill="none" stroke="#782C44" stroke-opacity=".22" stroke-dasharray="5 8"/>
    <path d="M470 460L1190 80M545 315H1170M850 45V586" stroke="#782C44" stroke-opacity=".22" fill="none"/>
    <circle cx="780" cy="238" r="8" fill="#E3B72F"/>
    <circle cx="780" cy="238" r="34" fill="url(#glow)"/>
    <circle cx="565" cy="315" r="5" fill="#A45A70" fill-opacity=".65"/>
    <circle cx="1138" cy="360" r="5" fill="#A45A70" fill-opacity=".7"/>
    <circle cx="1000" cy="166" r="3" fill="#E3B72F" fill-opacity=".65"/>
    <circle cx="908" cy="520" r="3" fill="#E3B72F" fill-opacity=".55"/>
    <path d="M640 630C680 530 725 485 805 470" fill="none" stroke="#E3B72F" stroke-opacity=".10" stroke-width="90"/>
  </g>
  <g font-family="Arial, Helvetica, sans-serif">
    <circle cx="87" cy="89" r="5" fill="#E3B72F"/>
    <text x="111" y="95" font-size="18" font-weight="700" letter-spacing="1.2" fill="#251B20">ARIA KIANZAD</text>
    <text x="111" y="120" font-family="monospace" font-size="12" letter-spacing="1.15" fill="#5A4A51">BRAND STRATEGY  /  PERSONAL BRANDING</text>
    <path d="M82 154V191" stroke="#E3B72F" stroke-opacity=".7"/>
    <text x="82" y="270" font-size="55" font-weight="700" fill="#251B20">Find the difference.</text>
    <text x="82" y="335" font-size="53" font-weight="400" fill="#E3B72F">Make it matter.</text>
    <rect x="84" y="372" width="69" height="4" rx="2" fill="#E3B72F"/>
    <text x="84" y="416" font-size="18" fill="#5A4A51">Research  ·  Positioning  ·  Identity</text>
    <text x="84" y="534" font-family="monospace" font-size="13" letter-spacing=".7" fill="#7D6D74">ariakianzad.github.io</text>
    <text x="1110" y="88" text-anchor="end" font-family="monospace" font-size="12" letter-spacing="1" fill="#782C44">01 / SIGNAL</text>
  </g>
</svg>`;

const coverPath = join(root, "public/Mian-e-Ma/assets/mian-e-ma-cover-v2.webp");
const coverMetadata = await sharp(coverPath).metadata();
if (!coverMetadata.width || !coverMetadata.height) {
  throw new Error("Book cover image metadata could not be read.");
}
const coverCropHeight = Math.round(coverMetadata.height * 0.892);
const coverForCard = await sharp(coverPath)
  .extract({
    left: 0,
    top: 0,
    width: coverMetadata.width,
    height: coverCropHeight,
  })
  .png()
  .toBuffer();

const coverData = `data:image/png;base64,${coverForCard.toString("base64")}`;
const bookSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#FBFBF7"/>
    </linearGradient>
    <filter id="coverShadow" x="-20%" y="-15%" width="145%" height="145%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="11" result="blur"/>
      <feOffset in="blur" dx="0" dy="9" result="offset"/>
      <feColorMatrix in="offset" type="matrix" values="0 0 0 0 .09 0 0 0 0 .16 0 0 0 0 .15 0 0 0 .20 0" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      .fa { font-family: "Estedad", "Noto Sans Arabic", sans-serif; }
    </style>
  </defs>
  <rect width="1200" height="630" fill="url(#paper)"/>
  <rect x="40" y="40" width="1120" height="550" rx="4" fill="none" stroke="#782C44" stroke-opacity=".18"/>
  <path d="M82 120H1118" stroke="#782C44" stroke-opacity=".20"/>
  <path d="M82 520H1118" stroke="#782C44" stroke-opacity=".12"/>
  <g opacity=".10" fill="none" stroke="#E3B72F" stroke-width="1.2">
    <path d="M630 220C655 158 735 124 807 145C890 168 930 244 922 316C913 394 842 477 777 513"/>
    <path d="M652 246C686 196 731 183 775 192C834 205 879 257 879 320C879 375 838 432 793 469"/>
    <path d="M694 167C722 219 726 257 709 297C691 339 701 390 746 447"/>
  </g>
  <!-- RTL text is end-anchored at x=770, keeping the copy column clear of the cover beginning at x=850. -->
  <text class="fa" x="770" y="154" text-anchor="end" direction="rtl" font-size="22" fill="#5A4A51">نسخۀ دیجیتال، برای مطالعۀ رایگان</text>
  <text class="fa" x="770" y="218" text-anchor="end" direction="rtl" font-size="64" font-weight="700" fill="#4B1D2C">میان ما</text>
  <rect x="678" y="258" width="92" height="4" rx="2" fill="#E3B72F"/>
  <text class="fa" x="770" y="314" text-anchor="end" direction="rtl" font-size="34" font-weight="700" fill="#4B1D2C">شناخت رابطه، صمیمیت و</text>
  <text class="fa" x="770" y="358" text-anchor="end" direction="rtl" font-size="34" font-weight="700" fill="#4B1D2C">مسئولیت‌پذیری عاطفی</text>
  <text class="fa" x="770" y="412" text-anchor="end" direction="rtl" font-size="26" fill="#5A4A51">برای فهم بهترِ گفت‌وگو، تعهد و آنچه</text>
  <text class="fa" x="770" y="449" text-anchor="end" direction="rtl" font-size="26" fill="#5A4A51">میان دو نفر شکل می‌گیرد.</text>
  <text x="82" y="557" font-family="monospace" font-size="12" letter-spacing=".6" fill="#7D6D74">MIAN-E-MA  /  BETWEEN US</text>
  <image href="${coverData}" x="850" y="77" width="285" height="361" preserveAspectRatio="xMidYMid meet" filter="url(#coverShadow)"/>
</svg>`;

await mkdir(join(outputRoot, "og"), { recursive: true });
await mkdir(join(outputRoot, "Mian-e-Ma/assets"), { recursive: true });

await sharp(renderSvg(homepageSvg))
  .jpeg({ quality: 91, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toFile(join(outputRoot, "og/og.jpg"));

await sharp(renderSvg(bookSvg))
  .jpeg({ quality: 93, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toFile(join(outputRoot, "Mian-e-Ma/assets/mian-e-ma-social-preview.jpg"));

for (const file of [
  join(outputRoot, "og/og.jpg"),
  join(outputRoot, "Mian-e-Ma/assets/mian-e-ma-social-preview.jpg"),
]) {
  const info = await sharp(file).metadata();
  if (info.width !== width || info.height !== height || info.format !== "jpeg") {
    throw new Error(`Invalid social preview output: ${file}`);
  }
}

console.log("Social previews generated with bundled Estedad fonts: homepage and book page (1200x630 JPEG).");
