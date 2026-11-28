import { readFileSync } from "node:fs";
import sharp from "sharp";

const files = [
  "assets-src/aria-kianzad-favicon.png",
  "public/brand-logo.png",
];

const buffers = files.map((file) => readFileSync(file));
if (!buffers[0].equals(buffers[1])) {
  throw new Error("The canonical source logo and public header logo must be byte-identical.");
}

for (const file of files) {
  const image = sharp(file, { failOn: "error" });
  const metadata = await image.metadata();
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (metadata.format !== "png" || metadata.width !== 512 || metadata.height !== 512) {
    throw new Error(`${file}: expected a 512x512 PNG.`);
  }
  if (info.width !== 512 || info.height !== 512 || info.channels !== 4 || data.length !== 512 * 512 * 4) {
    throw new Error(`${file}: image decoding did not produce the complete RGBA pixel buffer.`);
  }
}

console.log("Brand logo assets are complete, decodable, and byte-identical (512x512 RGBA).");
