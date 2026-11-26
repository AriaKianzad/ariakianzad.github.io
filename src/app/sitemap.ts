import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getBlogPosts, getBlogCategories, getBlogSettings } from "@/lib/blog-data";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const settings = getBlogSettings();
  const allPosts = getBlogPosts();
  const latestModified = (items: typeof allPosts) => {
    const timestamps = items
      .map((post) => Date.parse(post.updated_at || post.published_at))
      .filter((timestamp) => Number.isFinite(timestamp));
    return timestamps.length ? new Date(Math.max(...timestamps)) : undefined;
  };
  const posts = settings.sitemap_include_articles && settings.default_robots_index
    ? allPosts.filter((post) => post.robots_index !== false)
    : [];
  const archiveLastModified = latestModified(allPosts);
  const categories = settings.sitemap_include_categories && settings.default_robots_index
    ? getBlogCategories().filter((category) => {
        const seo = settings.category_seo?.[category.slug];
        if (seo?.robots_index === false) return false;
        if (settings.noindex_empty_categories && category.count === 0) return false;
        return true;
      })
    : [];
  return [
    { url: new URL("/", site.url).toString(), changeFrequency: "yearly", priority: 1 },
    { url: new URL("/Mian-e-Ma/", site.url).toString(), changeFrequency: "yearly", priority: 0.8 },
    ...(settings.default_robots_index ? [{
      url: settings.canonical_url || new URL("/blog/", site.url).toString(),
      ...(archiveLastModified ? { lastModified: archiveLastModified } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }] : []),
    { url: new URL("/blog/contact/", site.url).toString(), changeFrequency: "yearly", priority: 0.45 },
    ...categories.map((category) => {
      const categoryPosts = allPosts.filter((post) => {
        const slugs = Array.isArray(post.categories) && post.categories.length
          ? post.categories
          : [post.primary_category || post.category].filter(Boolean);
        return slugs.includes(category.slug);
      });
      const categoryLastModified = latestModified(categoryPosts);
      return {
        url: settings.category_seo?.[category.slug]?.canonical_url ||
          new URL("/blog/category/" + encodeURIComponent(category.slug) + "/", site.url).toString(),
        ...(categoryLastModified ? { lastModified: categoryLastModified } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.65,
      };
    }),
    ...posts.map((post) => ({
      url: post.canonical_url || new URL("/blog/" + post.slug + "/", site.url).toString(),
      lastModified: new Date(post.updated_at || post.published_at),
      changeFrequency: "monthly" as const,
      priority: post.featured ? 0.85 : 0.75,
    })),
  ];
}
