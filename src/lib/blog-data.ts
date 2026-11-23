import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPostCategorySlugs, getPrimaryCategorySlug } from "./blog-category-utils";
export { getPostCategorySlugs, getPrimaryCategorySlug } from "./blog-category-utils";

export type BlogCategory={slug:string;name:string};
export type BlogCategorySeo={
  description:string;seo_title:string;meta_description:string;og_title:string;og_description:string;
  canonical_url:string;robots_index:boolean;robots_follow:boolean;
};
export type BlogFaq={question:string;answer:string};
export type BlogPost={
  id:string;slug:string;title:string;excerpt:string;content:string;language:"fa"|"en";
  category:string;categories?:string[];primary_category?:string;tags:string[];hero_image_url?:string|null;hero_image_alt:string;hero_image_caption:string;
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
  default_og_image:string;footer_note:string;categories:BlogCategory[];
  category_seo:Record<string,BlogCategorySeo>;
  default_og_title:string;default_og_description:string;default_robots_index:boolean;default_robots_follow:boolean;
  noindex_empty_categories:boolean;sitemap_include_categories:boolean;sitemap_include_articles:boolean;
  schema_type:"Article"|"BlogPosting";breadcrumbs_enabled:boolean;breadcrumb_home_label:string;
  open_graph_enabled:boolean;twitter_card_type:"summary"|"summary_large_image";
};
const defaults:BlogSettings={
  title:"نوشته‌ها",tagline:"یادداشت‌هایی درباره برند، معنا و ارتباط",
  description:"اینجا درباره استراتژی برند، جایگاه‌یابی، ارتباطات و پرسونال برندینگ می‌نویسم؛ با تمرکز بر معنا، رفتار آدم‌ها و تصمیم‌هایی که پشت برندها قرار دارن.",
  background_theme:"paper",accent_color:"#a86f54",card_style:"editorial",layout_style:"editorial",
  content_width:"reading",posts_per_page:9,show_search:true,show_categories:true,show_featured:true,
  show_reading_time:true,show_toc:true,show_related_posts:true,show_share:true,enable_rss:true,
  default_language:"fa",heading_scale:1,body_line_height:1.95,intro_title:"از استراتژی برند تا ارتباطات روزمره",
  intro_body:"من اینجا درباره استراتژی برند، جایگاه‌یابی، هویت، ارتباطات و پرسونال برندینگ می‌نویسم؛ با تمرکز بر رفتار آدم‌ها و تصمیم‌هایی که پشت برندها قرار دارن.",
  default_meta_title:"وبلاگ آریا کیانزاد",default_meta_description:"",default_og_image:"",footer_note:"",
  categories:[{slug:"brand-and-business",name:"برند و کسب‌وکار"}],category_seo:{},
  default_og_title:"",default_og_description:"",default_robots_index:true,default_robots_follow:true,
  noindex_empty_categories:true,sitemap_include_categories:true,sitemap_include_articles:true,
  schema_type:"Article",breadcrumbs_enabled:true,breadcrumb_home_label:"خانه",
  open_graph_enabled:true,twitter_card_type:"summary_large_image",
};
type Payload={settings:BlogSettings;posts:BlogPost[]};
let cache:Payload|null=null;
function load():Payload{
  if(cache)return cache;
  try{
    const parsed=JSON.parse(readFileSync(join(process.cwd(),".cache","blog-content.json"),"utf8"));
    cache={
      settings:{...defaults,...(parsed.settings||{}),
        categories:Array.isArray(parsed.settings?.categories)?parsed.settings.categories:defaults.categories,
        category_seo:parsed.settings?.category_seo||{},
      },
      posts:Array.isArray(parsed.posts)?parsed.posts:[],
    };
  }catch{cache={settings:defaults,posts:[]};}
  return cache;
}
export const getBlogSettings=()=>load().settings;
export const getBlogPosts=()=>[...load().posts].sort((a,b)=>new Date(b.published_at).getTime()-new Date(a.published_at).getTime());
export const getBlogPost=(slug:string)=>getBlogPosts().find((post)=>post.slug===slug);
export function slugifyCategory(value:string){return value.trim().toLowerCase().replace(/\s+/g,"-");}
export function getBlogCategoryName(slug:string){
  const category=getBlogSettings().categories.find((item)=>item.slug===slug);
  if(category)return category.name;
  return slug.replace(/-/g," ");
}
export function getBlogCategories(){
  const posts=getBlogPosts(),settings=getBlogSettings(),counts=new Map<string,number>();
  for(const post of posts){
    for(const slug of getPostCategorySlugs(post))counts.set(slug,(counts.get(slug)||0)+1);
  }
  const configured=settings.categories||[];
  const seen=new Set<string>();
  const result: {slug:string;name:string;count:number}[]=[];
  for(const item of configured){
    if(!item?.slug||!item.name||seen.has(item.slug))continue;
    seen.add(item.slug);
    result.push({slug:item.slug,name:item.name,count:counts.get(item.slug)||0});
  }
  for(const [slug,count] of counts){
    if(seen.has(slug))continue;
    result.push({slug,name:slug.replace(/-/g," "),count});
  }
  return result.sort((a,b)=>a.name.localeCompare(b.name,"fa"));
}
export const getPostsByCategory=(slug:string)=>getBlogPosts().filter((post)=>getPostCategorySlugs(post).includes(slug));
export function readingTime(content:string,language:"fa"|"en"="fa"){
  const words=content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1,Math.ceil(words/(language==="fa"?180:220)));
}
