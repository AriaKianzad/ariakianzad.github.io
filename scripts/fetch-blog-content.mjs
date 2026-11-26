import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const configSource = await readFile(resolve("public/admin/config.js"), "utf8");
const url = configSource.match(/supabaseUrl:\s*"([^"]+)"/)?.[1];
const key = configSource.match(/supabaseAnonKey:\s*"([^"]+)"/)?.[1];
if (!url || !key || !key.startsWith("sb_publishable_")) throw new Error("Public Supabase configuration not found.");
const response = await fetch(url.replace(/\/+$/, "") + "/rest/v1/rpc/get_public_blog_payload", {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json", Accept: "application/json" },
  body: "{}", signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error("Could not fetch published blog payload (HTTP " + response.status + ").");
const payload = await response.json();
if (!payload || !Array.isArray(payload.posts) || typeof payload.settings !== "object") throw new Error("Published blog payload has an unexpected structure.");
const s = payload.settings || {};
const rawAccent = typeof s.accent_color === "string" && /^#[0-9a-f]{6}$/i.test(s.accent_color)
  ? s.accent_color
  : "#7b3f58";
const accentColor = rawAccent.toLowerCase() === "#a86f54" ? "#7b3f58" : rawAccent;
const result = {
  settings: {
    title:s.title||"نوشته‌ها", tagline:s.tagline||"یادداشت‌هایی درباره برند، معنا و ارتباط",
    description:s.description||"", canonical_url:s.canonical_url||"", background_theme:s.background_theme||"paper",
    accent_color:accentColor, card_style:s.card_style||"editorial",
    layout_style:s.layout_style||"editorial", content_width:s.content_width||"reading",
    posts_per_page:Math.min(24,Math.max(3,Number(s.posts_per_page||9))),
    show_search:s.show_search!==false, show_categories:s.show_categories!==false,
    show_featured:s.show_featured!==false, show_reading_time:s.show_reading_time!==false,
    show_toc:s.show_toc!==false, show_related_posts:s.show_related_posts!==false,
    show_share:s.show_share!==false, enable_rss:s.enable_rss!==false,
    default_language:s.default_language||"fa", heading_scale:Number(s.heading_scale||1),
    body_line_height:Number(s.body_line_height||1.95), intro_title:s.intro_title||"",
    intro_body:s.intro_body||"", default_meta_title:s.default_meta_title||"وبلاگ آریا کیانزاد",
    default_meta_description:s.default_meta_description||"", default_og_image:s.default_og_image||"",
    footer_note:s.footer_note||"", categories:Array.isArray(s.categories)?s.categories:[],
    category_seo:s.category_seo||{},
    default_og_title:s.default_og_title||"", default_og_description:s.default_og_description||"",
    default_robots_index:s.default_robots_index!==false, default_robots_follow:s.default_robots_follow!==false,
    noindex_empty_categories:s.noindex_empty_categories!==false,
    sitemap_include_categories:s.sitemap_include_categories!==false,
    sitemap_include_articles:s.sitemap_include_articles!==false,
    schema_type:s.schema_type==="BlogPosting"?"BlogPosting":"Article",
    breadcrumbs_enabled:s.breadcrumbs_enabled!==false,breadcrumb_home_label:s.breadcrumb_home_label||"خانه",
    open_graph_enabled:s.open_graph_enabled!==false,
    twitter_card_type:s.twitter_card_type==="summary"?"summary":"summary_large_image",
    ad_banners:Array.isArray(s.ad_banners)
      ?s.ad_banners.filter((banner)=>banner&&typeof banner==="object"&&!Array.isArray(banner)).map((banner)=>({...banner,show_on_mobile:banner.show_on_mobile!==false}))
      :[],
  },
  posts:payload.posts.filter((p)=>p&&typeof p.slug==="string"&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)&&typeof p.content==="string"),
  fetchedAt:new Date().toISOString(),
};
const output=resolve(".cache/blog-content.json");
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(result,null,2)+"\n","utf8");
console.log("Fetched "+result.posts.length+" published blog post(s) from Supabase.");
