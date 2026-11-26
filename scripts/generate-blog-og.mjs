import sharp from "sharp";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
const data=JSON.parse(await readFile(".cache/blog-content.json","utf8"));
const outputDir=resolve("public/og/blog");
const MEDIA_ORIGIN="https://bkohdqwecnvbmeaiuyyx.supabase.co";
const MEDIA_PATH="/storage/v1/object/public/blog-media/";
const MAX_MEDIA_BYTES=8*1024*1024;

function trustedMediaUrl(value){
  if(typeof value!=="string"||!value)return null;
  try{
    const url=new URL(value);
    if(
      url.protocol!=="https:"||
      url.origin!==MEDIA_ORIGIN||
      !url.pathname.startsWith(MEDIA_PATH)||
      url.username||url.password||url.search||url.hash
    )return null;
    return url.href;
  }catch{return null;}
}
await mkdir(outputDir,{recursive:true});
for(const name of await readdir(outputDir)){if(/\.(jpe?g|png)$/i.test(name))await rm(resolve(outputDir,name),{force:true});}
const accent="#7b3f58";
function xml(value){return String(value).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));}
for(const post of data.posts||[]){
  const target=resolve(outputDir,post.slug+".jpg");
  const image=trustedMediaUrl(post.og_image_url||post.hero_image_url);
  let pipeline=null;
  if(image){
    try{
      const response=await fetch(image,{signal:AbortSignal.timeout(15000),redirect:"error"});
      if(!response.ok)throw new Error("image");
      const declaredSize=Number(response.headers.get("content-length")||0);
      if(declaredSize>MAX_MEDIA_BYTES)throw new Error("image too large");
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length>MAX_MEDIA_BYTES)throw new Error("image too large");
      pipeline=sharp(bytes).rotate().resize(1200,630,{fit:"cover",position:"attention"});
    }catch{pipeline=null;}
  }
  if(pipeline){await pipeline.jpeg({quality:88,mozjpeg:true}).toFile(target);continue;}
  const title=xml(String(post.title||"Aria Kianzad").slice(0,70));
  const svg=[
    '<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">',
    '<rect width="1200" height="630" fill="#f3f0e8"/>',
    '<circle cx="80" cy="90" r="230" fill="#e7e0d6"/><circle cx="1140" cy="590" r="290" fill="#fbf9f4"/>',
    '<circle cx="1080" cy="110" r="18" fill="#d6a443"/>',
    '<rect x="104" y="110" width="7" height="100" fill="'+accent+'"/>',
    '<text x="1080" y="150" text-anchor="end" font-family="Arial,sans-serif" font-size="22" letter-spacing="5" fill="#655b64">ARIA KIANZAD / WRITING</text>',
    '<text x="1080" y="330" text-anchor="end" direction="rtl" font-family="Estedad,sans-serif" font-size="62" font-weight="700" fill="#28242b">'+title+'</text>',
    '<path d="M120 510 H1080" stroke="#7b3f58" stroke-opacity=".24" stroke-width="2"/>',
    '<text x="1080" y="568" text-anchor="end" font-family="Arial,sans-serif" font-size="18" letter-spacing="4" fill="#807780">BRAND STRATEGY · PERSONAL BRANDING</text></svg>'
  ].join("");
  await sharp(Buffer.from(svg)).jpeg({quality:88,mozjpeg:true}).toFile(target);
}
console.log("Generated "+(data.posts||[]).length+" blog social image(s).");
