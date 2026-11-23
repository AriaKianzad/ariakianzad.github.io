import type { Metadata } from "next";
import { site } from "@/lib/site";
import { getBlogCategories, getBlogPosts, getBlogSettings } from "@/lib/blog-data";
import { BlogHeader, BlogFooter } from "./BlogHeader";
import { BlogListingClient, BlogPostCard } from "./BlogListingClient";

const blogSettings = getBlogSettings();

export const metadata: Metadata = {
  title: blogSettings.default_meta_title || "یادداشت‌هایی درباره برند، معنا و ارتباط | آریا کیانزاد",
  description: blogSettings.default_meta_description || blogSettings.description || "اینجا درباره استراتژی برند، جایگاه‌یابی، ارتباطات و پرسونال برندینگ می‌نویسم؛ با تمرکز بر معنا، رفتار آدم‌ها و تصمیم‌هایی که پشت برندها قرار دارن.",
  alternates: { canonical: site.url + "/blog/", types: { "application/rss+xml": site.url + "/blog/feed.xml" } },
  openGraph: {
    type: "website", url: site.url + "/blog/", siteName: "Aria Kianzad",
    title: "یادداشت‌هایی درباره برند، معنا و ارتباط | آریا کیانزاد",
    description: "از استراتژی برند و جایگاه‌یابی تا ارتباطات و پرسونال برندینگ؛ اینجا از نگاه و تجربهٔ خودم می‌نویسم.",
    images: [{ url: blogSettings.default_og_image || site.url + "/og/og.jpg", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", title: "یادداشت‌هایی درباره برند، معنا و ارتباط | آریا کیانزاد", images: [site.url + "/og/og.jpg"] },
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
    url: site.url + "/blog/", inLanguage: settings.default_language === "fa" ? "fa-IR" : "en",
    publisher: { "@type": "Person", name: "Aria Kianzad", url: site.url },
  };
  return (
    <>
      <BlogHeader />
      <main className="blog-main" dir={settings.default_language === "fa" ? "rtl" : "ltr"}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
        <section className="blog-intro blog-container">
          <div className="blog-eyebrow"><span /> WRITING / BRAND STRATEGY</div>
          <h1>{settings.tagline || "یادداشت‌هایی درباره برند، معنا و ارتباط"}</h1>
          <p className="blog-intro-lede">{settings.intro_title || "از استراتژی برند تا ارتباطات روزمره"}</p>
          <p className="blog-intro-description">{settings.intro_body || settings.description}</p>
          <div className="blog-intro-rule"><span>01</span><span>IDEAS, RESEARCH &amp; PERSPECTIVE</span></div>
        </section>
        {featured ? (
          <section className="blog-featured-section blog-container" aria-label="نوشتۀ منتخب">
            <div className="blog-section-label"><span>01</span> نوشتۀ منتخب</div>
            <BlogPostCard post={featured} featured />
          </section>
        ) : null}
        <section className="blog-listing-section blog-container" aria-labelledby="blog-list-title">
          <div className="blog-section-heading">
            <div><span className="blog-section-label"><span>02</span> ARCHIVE</span><h2 id="blog-list-title">از میان نوشته‌ها</h2></div>
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
