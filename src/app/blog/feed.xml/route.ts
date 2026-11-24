import { getBlogPosts, getBlogSettings, getBlogCategoryName, getPostCategorySlugs } from "@/lib/blog-data";
import { site } from "@/lib/site";

export const dynamic = "force-static";

function xml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character] || character);
}

export function GET() {
  const settings = getBlogSettings();
  const blogUrl = settings.canonical_url || site.url + "/blog/";
  const posts = getBlogPosts();
  const items = posts.map((post) => {
    const articleUrl = post.canonical_url || site.url + "/blog/" + post.slug + "/";
    return [
    "<item>",
    "<title>" + xml(post.title) + "</title>",
    "<link>" + xml(articleUrl) + "</link>",
    "<guid isPermaLink=\"true\">" + xml(articleUrl) + "</guid>",
    "<description>" + xml(post.excerpt || post.meta_description || "") + "</description>",
    "<pubDate>" + new Date(post.published_at).toUTCString() + "</pubDate>",
    ...getPostCategorySlugs(post).map((slug) => "<category>" + xml(getBlogCategoryName(slug)) + "</category>"),
    "</item>",
  ].join("");
  }).join("");
  const body = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0"><channel><title>' + xml(settings.title) + '</title>' +
    '<link>' + xml(blogUrl) + '</link><description>' + xml(settings.description) + '</description>' +
    '<language>' + (settings.default_language === "fa" ? "fa-ir" : "en-us") + '</language>' +
    items + '</channel></rss>';
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
