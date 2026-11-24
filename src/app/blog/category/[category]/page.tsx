import type { Metadata } from "next";
import Link from "next/link";
import { getBlogCategories, getBlogSettings, getPostsByCategory } from "@/lib/blog-data";
import { site } from "@/lib/site";
import { BlogHeader, BlogFooter } from "../../BlogHeader";
import { BlogPostCard } from "../../BlogListingClient";

export const dynamicParams = false;

export function generateStaticParams() {
  const categories = getBlogCategories();
  return categories.length
    ? categories.map((category) => ({ category: category.slug }))
    : [{ category: "__empty__" }];
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const item = getBlogCategories().find((entry) => entry.slug === category);
  if (!item) return { title: "دسته‌بندی پیدا نشد | آریا کیانزاد", robots: { index: false, follow: false } };

  const settings = getBlogSettings();
  const seo = settings.category_seo?.[category];
  const postCount = getPostsByCategory(category).length;
  const fallbackDescription = "یادداشت‌ها و مقاله‌های من دربارهٔ " + item.name + ".";
  const description = seo?.meta_description || seo?.description || fallbackDescription;
  const canonical = seo?.canonical_url || site.url + "/blog/category/" + encodeURIComponent(category) + "/";
  const title = seo?.seo_title || item.name + " | نوشته‌های آریا کیانزاد";
  const ogTitle = seo?.og_title || settings.default_og_title || title;
  const ogDescription = seo?.og_description || settings.default_og_description || description;
  const index = settings.default_robots_index && seo?.robots_index !== false && !(postCount === 0 && settings.noindex_empty_categories);
  const follow = settings.default_robots_follow && seo?.robots_follow !== false;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index, follow },
    openGraph: settings.open_graph_enabled ? {
      type: "website", url: canonical, siteName: "Aria Kianzad", title: ogTitle, description: ogDescription,
      images: [{ url: settings.default_og_image || site.url + "/og/og.jpg", width: 1200, height: 630 }],
    } : undefined,
    twitter: {
      card: settings.twitter_card_type, title: ogTitle, description: ogDescription,
      images: [settings.default_og_image || site.url + "/og/og.jpg"],
    },
  };
}

export default async function BlogCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const item = getBlogCategories().find((entry) => entry.slug === category);
  const settings = getBlogSettings();

  if (!item) {
    return (
      <>
        <BlogHeader />
        <main id="main" className="blog-main" dir="rtl">
          <section className="blog-container blog-category-heading">
            <h1>هنوز دسته‌بندی‌ای برای نمایش وجود نداره.</h1>
            <p>بعد از انتشار اولین مقاله، دسته‌بندی‌ها اینجا نمایش داده می‌شن.</p>
            <Link href="/blog/">بازگشت به نوشته‌ها</Link>
          </section>
        </main>
        <BlogFooter />
      </>
    );
  }

  const posts = getPostsByCategory(category);
  const seo = settings.category_seo?.[category];
  return (
    <>
      <BlogHeader />
      <main id="main" className="blog-main" dir="rtl">
        <section className="blog-container blog-category-heading">
          {settings.breadcrumbs_enabled ? <nav className="blog-breadcrumbs blog-category-breadcrumbs" aria-label="مسیر راهنما"><Link href="/blog/">{settings.breadcrumb_home_label || "خانه"}</Link><span aria-hidden="true">/</span><span>{item.name}</span></nav> : null}
          <h1>{item.name}</h1>
          {seo?.description ? <p className="blog-category-description">{seo.description}</p> : null}
          <p className="blog-category-count">{posts.length.toLocaleString("fa-IR")} نوشته</p>
          <Link href="/blog/">← بازگشت به نوشته‌ها</Link>
        </section>
        <section className="blog-container blog-listing-section" aria-label={"نوشته‌های دسته‌بندی " + item.name}>
          <div className="blog-card-grid">
            {posts.map((post) => <BlogPostCard key={post.slug} post={post} categoryName={item.name} showReadingTime={settings.show_reading_time} />)}
          </div>
        </section>
      </main>
      <BlogFooter />
    </>
  );
}
