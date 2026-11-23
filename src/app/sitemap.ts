import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getBlogPosts, getBlogCategories } from "@/lib/blog-data";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getBlogPosts();
  const categories = getBlogCategories();
  return [
    { url: new URL("/", site.url).toString(), changeFrequency: "yearly", priority: 1 },
    { url: new URL("/Mian-e-Ma/", site.url).toString(), changeFrequency: "yearly", priority: 0.8 },
    { url: new URL("/blog/", site.url).toString(), changeFrequency: "weekly", priority: 0.9 },
    ...categories.map((category) => ({
      url: new URL("/blog/category/" + encodeURIComponent(category.slug) + "/", site.url).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.65,
    })),
    ...posts.map((post) => ({
      url: new URL("/blog/" + post.slug + "/", site.url).toString(),
      lastModified: new Date(post.updated_at || post.published_at),
      changeFrequency: "monthly" as const,
      priority: post.featured ? 0.85 : 0.75,
    })),
  ];
}
