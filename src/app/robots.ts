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
      allow: ["/", "/blog/"],
      disallow: ["/admin/", "/admin/blog/"],
    },
    sitemap: sitemapUrls,
  };
}
