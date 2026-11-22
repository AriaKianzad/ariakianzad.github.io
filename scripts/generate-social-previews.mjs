import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const outputRoot = join(root, "out");
const width = 1200;
const height = 630;

const read = (path) => readFile(join(root, path));
const [estedadRegular, estedadSemiBold] = await Promise.all([
  read("assets-src/Estedad-Regular.ttf"),
  read("assets-src/Estedad-SemiBold.ttf"),
]);

const estedadFaces = `
  @font-face {
    font-family: "Estedad";
    src: url(data:font/ttf;base64,${estedadRegular.toString("base64")}) format("truetype");
    font-weight: 400;
  }
  @font-face {
    font-family: "Estedad";
    src: url(data:font/ttf;base64,${estedadSemiBold.toString("base64")}) format("truetype");
    font-weight: 600 900;
  }
`;

const homepageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#080d0b"/>
      <stop offset="0.6" stop-color="#0b110e"/>
      <stop offset="1" stop-color="#070b09"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="#c6e887" stop-opacity=".32"/>
      <stop offset=".28" stop-color="#879d63" stop-opacity=".12"/>
      <stop offset="1" stop-color="#879d63" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse">
      <path d="M72 0H0V72" fill="none" stroke="#cfdec3" stroke-opacity=".055" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#background)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect x="54" y="48" width="1092" height="534" rx="4" fill="none" stroke="#d2dfc6" stroke-opacity=".34"/>
  <g opacity=".9">
    <circle cx="850" cy="315" r="232" fill="url(#glow)"/>
    <circle cx="850" cy="315" r="204" fill="none" stroke="#bdcba9" stroke-opacity=".35" stroke-width="1.4"/>
    <ellipse cx="850" cy="315" rx="310" ry="105" transform="rotate(-9 850 315)" fill="none" stroke="#bdcba9" stroke-opacity=".40"/>
    <ellipse cx="850" cy="315" rx="260" ry="154" transform="rotate(22 850 315)" fill="none" stroke="#bdcba9" stroke-opacity=".26"/>
    <ellipse cx="850" cy="315" rx="115" ry="265" transform="rotate(4 850 315)" fill="none" stroke="#bdcba9" stroke-opacity=".22" stroke-dasharray="5 8"/>
    <path d="M470 460L1190 80M545 315H1170M850 45V586" stroke="#c6d5b6" stroke-opacity=".22" fill="none"/>
    <circle cx="780" cy="238" r="8" fill="#c6e887"/>
    <circle cx="780" cy="238" r="34" fill="url(#glow)"/>
    <circle cx="565" cy="315" r="5" fill="#a9ba94" fill-opacity=".65"/>
    <circle cx="1138" cy="360" r="5" fill="#a9ba94" fill-opacity=".7"/>
    <circle cx="1000" cy="166" r="3" fill="#c6e887" fill-opacity=".65"/>
    <circle cx="908" cy="520" r="3" fill="#c6e887" fill-opacity=".55"/>
    <path d="M640 630C680 530 725 485 805 470" fill="none" stroke="#c6e887" stroke-opacity=".10" stroke-width="90"/>
  </g>
  <g font-family="Arial, Helvetica, sans-serif">
    <circle cx="87" cy="89" r="5" fill="#c6e887"/>
    <text x="111" y="95" font-size="18" font-weight="700" letter-spacing="1.2" fill="#eff2e8">ARIA KIANZAD</text>
    <text x="111" y="120" font-family="monospace" font-size="12" letter-spacing="1.15" fill="#b9c3b8">BRAND STRATEGY  /  PERSONAL BRANDING</text>
    <path d="M82 154V191" stroke="#c6e887" stroke-opacity=".7"/>
    <text x="82" y="270" font-size="55" font-weight="700" fill="#eff2e8">Find the difference.</text>
    <text x="82" y="335" font-size="53" font-weight="400" fill="#c6e887">Make it matter.</text>
    <rect x="84" y="372" width="69" height="4" rx="2" fill="#c6e887"/>
    <text x="84" y="416" font-size="18" fill="#b9c3b8">Research  ·  Positioning  ·  Identity</text>
    <text x="84" y="534" font-family="monospace" font-size="13" letter-spacing=".7" fill="#abb8a8">ariakianzad.github.io</text>
    <text x="1110" y="88" text-anchor="end" font-family="monospace" font-size="12" letter-spacing="1" fill="#d5e2ca">01 / SIGNAL</text>
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
      <stop offset="0" stop-color="#fafaf5"/>
      <stop offset="1" stop-color="#f2f3ec"/>
    </linearGradient>
    <filter id="coverShadow" x="-20%" y="-15%" width="145%" height="145%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="11" result="blur"/>
      <feOffset in="blur" dx="0" dy="9" result="offset"/>
      <feColorMatrix in="offset" type="matrix" values="0 0 0 0 .09 0 0 0 0 .16 0 0 0 0 .15 0 0 0 .20 0" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      ${estedadFaces}
      .fa { font-family: "Estedad", "Noto Sans Arabic", sans-serif; }
    </style>
  </defs>
  <rect width="1200" height="630" fill="url(#paper)"/>
  <rect x="40" y="40" width="1120" height="550" rx="4" fill="none" stroke="#36534f" stroke-opacity=".18"/>
  <path d="M82 120H1118" stroke="#36534f" stroke-opacity=".20"/>
  <path d="M82 520H1118" stroke="#36534f" stroke-opacity=".12"/>
  <g opacity=".10" fill="none" stroke="#78958f" stroke-width="1.2">
    <path d="M630 220C655 158 735 124 807 145C890 168 930 244 922 316C913 394 842 477 777 513"/>
    <path d="M652 246C686 196 731 183 775 192C834 205 879 257 879 320C879 375 838 432 793 469"/>
    <path d="M694 167C722 219 726 257 709 297C691 339 701 390 746 447"/>
  </g>
  <text class="fa" x="770" y="154" text-anchor="start" direction="rtl" font-size="18" fill="#556b69">نسخۀ دیجیتال، برای مطالعۀ رایگان</text>
  <text class="fa" x="770" y="218" text-anchor="start" direction="rtl" font-size="54" font-weight="700" fill="#244241">میانِ ما</text>
  <rect x="704" y="295" width="66" height="4" rx="2" fill="#78958f"/>
  <text class="fa" x="770" y="340" text-anchor="start" direction="rtl" font-size="27" font-weight="700" fill="#244241">شناخت رابطه، صمیمیت و</text>
  <text class="fa" x="770" y="382" text-anchor="start" direction="rtl" font-size="27" font-weight="700" fill="#244241">مسئولیت‌پذیری عاطفی</text>
  <text class="fa" x="770" y="430" text-anchor="start" direction="rtl" font-size="22" fill="#556b69">برای فهم بهترِ گفت‌وگو، تعهد و آنچه</text>
  <text class="fa" x="770" y="463" text-anchor="start" direction="rtl" font-size="22" fill="#556b69">میان دو نفر شکل می‌گیرد.</text>
  <rect x="448" y="520" width="322" height="57" rx="3" fill="#244241"/>
  <text class="fa" x="749" y="558" text-anchor="start" direction="rtl" font-size="23" font-weight="700" fill="#f7f7f1">برای دریافت نسخۀ رایگان کلیک کنید</text>
  <text x="82" y="557" font-family="monospace" font-size="12" letter-spacing=".6" fill="#647b76">MIAN-E-MA  /  BETWEEN US</text>
  <image href="${coverData}" x="850" y="77" width="285" height="361" preserveAspectRatio="xMidYMid meet" filter="url(#coverShadow)"/>
</svg>`;

await mkdir(join(outputRoot, "og"), { recursive: true });
await mkdir(join(outputRoot, "Mian-e-Ma/assets"), { recursive: true });

await sharp(Buffer.from(homepageSvg))
  .jpeg({ quality: 91, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toFile(join(outputRoot, "og/og.jpg"));

await sharp(Buffer.from(bookSvg))
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

console.log("Social previews generated: homepage and book page (1200x630 JPEG).");
