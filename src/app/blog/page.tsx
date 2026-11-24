import type { Metadata } from "next";
import { site } from "@/lib/site";
import { getBlogCategories, getBlogPosts, getBlogSettings, getBlogCategoryName, getPrimaryCategorySlug } from "@/lib/blog-data";
import { BlogHeader, BlogFooter } from "./BlogHeader";
import { BlogListingClient, BlogPostCard } from "./BlogListingClient";
import HeroVisual from "@/components/hero-visual";

const blogSettings = getBlogSettings();
const blogCanonicalUrl = blogSettings.canonical_url || site.url + "/blog/";

export const metadata: Metadata = {
  title: blogSettings.default_meta_title || "یادداشت‌هایی درباره برند، معنا و ارتباط | آریا کیانزاد",
  description: blogSettings.default_meta_description || blogSettings.description || "اینجا درباره استراتژی برند، جایگاه‌یابی، ارتباطات و پرسونال برندینگ می‌نویسم؛ با تمرکز بر معنا، رفتار آدم‌ها و تصمیم‌هایی که پشت برندها قرار دارن.",
  robots: { index: blogSettings.default_robots_index, follow: blogSettings.default_robots_follow },
  alternates: {
    canonical: blogCanonicalUrl,
    types: blogSettings.enable_rss ? { "application/rss+xml": site.url + "/blog/feed.xml" } : undefined,
  },
  openGraph: blogSettings.open_graph_enabled ? {
    type: "website", url: blogCanonicalUrl, siteName: "Aria Kianzad",
    title: blogSettings.default_og_title || "یادداشت‌هایی درباره برند، معنا و ارتباط | آریا کیانزاد",
    description: blogSettings.default_og_description || blogSettings.description,
    images: [{ url: blogSettings.default_og_image || site.url + "/og/og.jpg", width: 1200, height: 630 }],
  } : undefined,
  twitter: { card: blogSettings.twitter_card_type, title: blogSettings.default_og_title || blogSettings.default_meta_title, description: blogSettings.default_og_description || blogSettings.default_meta_description, images: [blogSettings.default_og_image || site.url + "/og/og.jpg"] },
};

export default function BlogIndexPage() {
  const settings = getBlogSettings();
  const posts = getBlogPosts();
  const categories = getBlogCategories();
  const featured = settings.show_featured ? posts.find((post) => post.featured) : undefined;
  const listing = featured ? posts.filter((post) => post.slug !== featured.slug) : posts;
  const schema = {
    "@context": "https://schema.org", "@type": "Blog",
    name: settings.title, description: settings.description,
    url: settings.canonical_url || site.url + "/blog/", inLanguage: settings.default_language === "fa" ? "fa-IR" : "en",
    publisher: { "@type": "Person", name: "Aria Kianzad", url: site.url },
  };
  return (
    <>
      <BlogHeader />
      <main id="main" tabIndex={-1} className="blog-main" dir={settings.default_language === "fa" ? "rtl" : "ltr"}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
        <section className="blog-intro blog-container" aria-labelledby="blog-intro-title">
          <div className="blog-intro-copy">
            <h1 id="blog-intro-title">{settings.tagline || "یادداشت‌هایی درباره برند، معنا و ارتباط"}</h1>
            <p className="blog-intro-lede">{settings.intro_title || "از استراتژی برند تا ارتباطات روزمره"}</p>
          </div>
          <div className="blog-intro-visual" aria-hidden="true">
            <HeroVisual />
          </div>
          {settings.description ? <p className="blog-intro-description">{settings.description}</p> : null}
        </section>
        {featured ? (
          <section className="blog-featured-section blog-container" aria-label="نوشتۀ منتخب">
            <div className="blog-section-label"><span>01</span> نوشتۀ منتخب</div>
            <BlogPostCard post={featured} categoryName={getBlogCategoryName(getPrimaryCategorySlug(featured))} featured showReadingTime={settings.show_reading_time} />
          </section>
        ) : null}
        <section className="blog-listing-section blog-container" aria-labelledby="blog-list-title">
          <div className="blog-section-heading">
            <div><h2 id="blog-list-title">از میان نوشته‌ها</h2></div>
            <p>موضوعات، دیدگاه‌ها و تصمیم‌هایی که شکل برندها رو می‌سازن.</p>
          </div>
          <BlogListingClient posts={listing} categories={categories}
            showSearch={settings.show_search} showCategories={settings.show_categories}
            showReadingTime={settings.show_reading_time} postsPerPage={settings.posts_per_page} />
        </section>
      </main>
      <BlogFooter />
    </>
  );
}
