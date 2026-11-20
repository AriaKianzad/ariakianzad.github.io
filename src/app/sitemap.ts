import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
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
  ];
}
