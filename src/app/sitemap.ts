import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getPublishedPosts, getBlogCategories } from "@/lib/blog-content";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories] = await Promise.all([getPublishedPosts(), getBlogCategories()]);
  return [
    {
      url: new URL("/", site.url).toString(),
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: new URL("/Mian-e-Ma/", site.url).toString(),
      changeFrequency: "yearly",
      priority: 0.8,
    },
    {
      url: new URL("/blog/", site.url).toString(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    ...categories.map((category) => ({
      url: new URL("/blog/category/" + encodeURIComponent(category.name) + "/", site.url).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...posts.filter((post) => post.robotsIndex !== false).map((post) => ({
      url: new URL("/blog/" + post.slug + "/", site.url).toString(),
      lastModified: post.publishedAt ? new Date(post.publishedAt) : undefined,
      changeFrequency: "monthly" as const,
      priority: post.featured ? 0.8 : 0.7,
    })),
  ];
}
