import { readFileSync } from "node:fs";
import { join } from "node:path";
export type BlogCategorySeo={description:string;seo_title:string;meta_description:string;og_title:string;og_description:string;canonical_url:string;robots_index:boolean;};
export type BlogFaq={question:string;answer:string};
export type BlogPost={
  id:string;slug:string;title:string;excerpt:string;content:string;language:"fa"|"en";
  category:string;tags:string[];hero_image_url?:string|null;hero_image_alt:string;hero_image_caption:string;
  og_image_url?:string|null;seo_title:string;meta_description:string;focus_keyword:string;
  canonical_url:string;og_title:string;og_description:string;robots_index:boolean;robots_follow:boolean;
  featured:boolean;toc_enabled:boolean;drop_cap:boolean;content_width:"reading"|"wide";accent_color:string;
  faqs:BlogFaq[];published_at:string;updated_at:string;
};
export type BlogSettings={
  title:string;tagline:string;description:string;background_theme:string;accent_color:string;card_style:string;
  layout_style:string;content_width:string;posts_per_page:number;show_search:boolean;show_categories:boolean;
  show_featured:boolean;show_reading_time:boolean;show_toc:boolean;show_related_posts:boolean;show_share:boolean;
  enable_rss:boolean;default_language:"fa"|"en";heading_scale:number;body_line_height:number;
  intro_title:string;intro_body:string;default_meta_title:string;default_meta_description:string;
  default_og_image:string;footer_note:string;category_seo:Record<string,BlogCategorySeo>;
};
const defaults:BlogSettings={
  title:"نوشته‌ها",tagline:"یادداشت‌هایی درباره برند، معنا و ارتباط",
  description:"اینجا درباره استراتژی برند، جایگاه‌یابی، ارتباطات و پرسونال برندینگ می‌نویسم؛ با تمرکز بر معنا، رفتار آدم‌ها و تصمیم‌هایی که پشت برندها قرار دارن.",
  background_theme:"paper",accent_color:"#a86f54",card_style:"editorial",layout_style:"editorial",
  content_width:"reading",posts_per_page:9,show_search:true,show_categories:true,show_featured:true,
  show_reading_time:true,show_toc:true,show_related_posts:true,show_share:true,enable_rss:true,
  default_language:"fa",heading_scale:1,body_line_height:1.95,intro_title:"از استراتژی برند تا ارتباطات روزمره",
  intro_body:"من اینجا درباره استراتژی برند، جایگاه‌یابی، هویت، ارتباطات و پرسونال برندینگ می‌نویسم؛ با تمرکز بر رفتار آدم‌ها و تصمیم‌هایی که پشت برندها قرار دارن.",default_meta_title:"وبلاگ آریا کیانزاد",default_meta_description:"",default_og_image:"",footer_note:"",category_seo:{},
};
type Payload={settings:BlogSettings;posts:BlogPost[]};
let cache:Payload|null=null;
function load():Payload{
  if(cache)return cache;
  try{
    const parsed=JSON.parse(readFileSync(join(process.cwd(),".cache","blog-content.json"),"utf8"));
    cache={settings:{...defaults,...(parsed.settings||{})},posts:Array.isArray(parsed.posts)?parsed.posts:[]};
  }catch{cache={settings:defaults,posts:[]};}
  return cache;
}
export const getBlogSettings=()=>load().settings;
export const getBlogPosts=()=>[...load().posts].sort((a,b)=>new Date(b.published_at).getTime()-new Date(a.published_at).getTime());
export const getBlogPost=(slug:string)=>getBlogPosts().find((post)=>post.slug===slug);
export function slugifyCategory(value:string){return value.trim().toLowerCase().replace(/\s+/g,"-");}
export function getBlogCategories(){
  const counts=new Map<string,number>();
  for(const post of getBlogPosts()){const name=(post.category||"").trim();if(name)counts.set(name,(counts.get(name)||0)+1);}
  return [...counts.entries()].map(([name,count])=>({name,count,slug:slugifyCategory(name)})).sort((a,b)=>a.name.localeCompare(b.name,"fa"));
}
export const getPostsByCategory=(slug:string)=>getBlogPosts().filter((post)=>slugifyCategory(post.category||"")===slug);
export function readingTime(content:string,language:"fa"|"en"="fa"){
  const words=content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1,Math.ceil(words/(language==="fa"?180:220)));
}
