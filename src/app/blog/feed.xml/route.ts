import { getPublishedPosts } from "@/lib/blog-content";

export const dynamic = "force-static";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await getPublishedPosts();
  const items = posts.map((post) => (
    "<item>" +
      "<title>" + escapeXml(post.title) + "</title>" +
      "<link>https://ariakianzad.github.io/blog/" + encodeURIComponent(post.slug) + "/</link>" +
      "<guid isPermaLink=\"true\">https://ariakianzad.github.io/blog/" + encodeURIComponent(post.slug) + "/</guid>" +
      "<description>" + escapeXml(post.metaDescription || post.excerpt) + "</description>" +
      "<pubDate>" + new Date(post.publishedAt || Date.now()).toUTCString() + "</pubDate>" +
      "<category>" + escapeXml(post.category) + "</category>" +
    "</item>"
  )).join("");
  const xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
    "<rss version=\"2.0\"><channel>" +
    "<title>وبلاگ آریا کیانزاد</title>" +
    "<link>https://ariakianzad.github.io/blog/</link>" +
    "<description>یادداشت‌هایی درباره استراتژی برند، پرسونال برندینگ و ارتباطات.</description>" +
    "<language>fa-IR</language>" + items +
    "</channel></rss>";
  return new Response(xml, { headers: {
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600, must-revalidate",
  }});
}
