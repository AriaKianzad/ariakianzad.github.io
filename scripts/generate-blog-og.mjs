import sharp from "sharp";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
const data=JSON.parse(await readFile(".cache/blog-content.json","utf8"));
const outputDir=resolve("public/og/blog");
await mkdir(outputDir,{recursive:true});
for(const name of await readdir(outputDir)){if(/\.(jpe?g|png)$/i.test(name))await rm(resolve(outputDir,name),{force:true});}
const candidate=data.settings?.accent_color||"#a86f54";
const accent=/^#[0-9a-fA-F]{6}$/.test(candidate)?candidate:"#a86f54";
function xml(value){return String(value).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));}
for(const post of data.posts||[]){
  const target=resolve(outputDir,post.slug+".jpg"), image=post.og_image_url||post.hero_image_url;
  let pipeline=null;
  if(image&&image.startsWith("https://")){
    try{const r=await fetch(image,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error("image");pipeline=sharp(Buffer.from(await r.arrayBuffer())).rotate().resize(1200,630,{fit:"cover",position:"attention"});}catch{pipeline=null;}
  }
  if(pipeline){await pipeline.jpeg({quality:88,mozjpeg:true}).toFile(target);continue;}
  const title=xml(String(post.title||"Aria Kianzad").slice(0,70));
  const svg=[
    '<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">',
    '<rect width="1200" height="630" fill="#f4f1e9"/>',
    '<circle cx="80" cy="90" r="230" fill="#e8e4da"/><circle cx="1140" cy="590" r="290" fill="#e9e5da"/>',
    '<rect x="104" y="110" width="7" height="100" fill="'+accent+'"/>',
    '<text x="1080" y="150" text-anchor="end" font-family="Arial,sans-serif" font-size="22" letter-spacing="5" fill="#777f77">ARIA KIANZAD / WRITING</text>',
    '<text x="1080" y="330" text-anchor="end" direction="rtl" font-family="Estedad,sans-serif" font-size="62" font-weight="700" fill="#1d3432">'+title+'</text>',
    '<path d="M120 510 H1080" stroke="#d8d5ca" stroke-width="2"/>',
    '<text x="1080" y="568" text-anchor="end" font-family="Arial,sans-serif" font-size="18" letter-spacing="4" fill="#777f77">BRAND STRATEGY · PERSONAL BRANDING</text></svg>'
  ].join("");
  await sharp(Buffer.from(svg)).jpeg({quality:88,mozjpeg:true}).toFile(target);
}
console.log("Generated "+(data.posts||[]).length+" blog social image(s).");
