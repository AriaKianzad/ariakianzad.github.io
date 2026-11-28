import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getBlogSettings } from "@/lib/blog-data";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const settings = getBlogSettings();
  const sitemapUrls = [
    site.url + "/sitemap.xml",
    ...(settings.enable_rss ? [site.url + "/blog/feed.xml"] : []),
  ];
  return {
    rules: {
      userAgent: "*",
      // Admin pages carry a noindex meta directive. They must remain crawlable
      // so search engines can read it; robots.txt is not an access-control layer.
      allow: ["/"],
    },
    sitemap: sitemapUrls,
  };
}
