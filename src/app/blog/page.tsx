import type { Metadata } from "next";
import Link from "next/link";
import { BlogFrame } from "@/components/blog-frame";
import { BlogPostCard } from "@/components/blog-post-card";
import { getBlogCategories, getBlogSettings, getPublishedPosts } from "@/lib/blog-content";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();
  const title = settings.defaultMetaTitle || settings.title;
  const description = settings.defaultMetaDescription || settings.description;
  const image = settings.defaultOgImage || undefined;
  return {
    title, description, alternates: { canonical: "/blog/" },
    openGraph: { type: "website", title, description, url: "/blog/", images: image ? [image] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function BlogArchivePage() {
  const [posts, categories, settings] = await Promise.all([
    getPublishedPosts(), getBlogCategories(), getBlogSettings(),
  ]);
  const featured = settings.showFeatured ? posts.find((post) => post.featured) : undefined;
  const rest = posts.filter((post) => post.slug !== featured?.slug);
  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: settings.title,
    description: settings.description,
    url: "https://ariakianzad.github.io/blog/",
    blogPost: posts.slice(0, 30).map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: "https://ariakianzad.github.io/blog/" + post.slug + "/",
      datePublished: post.publishedAt,
      description: post.metaDescription || post.excerpt,
    })),
  };

  return (
    <BlogFrame settings={settings}>
      <main>
        <section className="blog-hero">
          <span className="blog-kicker">PERSONAL JOURNAL / BRAND &amp; COMMUNICATION</span>
          <h1>{settings.title}</h1>
          <p>{settings.tagline}</p>
          <div className="blog-hero-actions">
            {settings.showSearch && <label className="blog-search"><span aria-hidden="true">⌕</span>
              <input id="blog-search" type="search" placeholder="جست‌وجو در مقاله‌ها…" aria-label="جست‌وجو در مقاله‌ها" />
            </label>}
            <span className="blog-post-count">{posts.length} نوشته</span>
          </div>
        </section>
        {settings.showCategories && categories.length > 0 && (
          <nav className="blog-categories" aria-label="دسته‌بندی مقاله‌ها">
            <Link className="is-active" href="/blog/">همه</Link>
            {categories.map((category) => (
              <Link key={category.name} href={"/blog/category/" + encodeURIComponent(category.name) + "/"}>
                {category.name} <span>({category.count})</span>
              </Link>
            ))}
          </nav>
        )}
        {featured && <section className="blog-featured">
          <div className="blog-section-heading"><h2>مقالۀ منتخب</h2><span>FEATURED / 01</span></div>
          <BlogPostCard post={featured} featured />
        </section>}
        <section className="blog-archive" aria-labelledby="blog-archive-title">
          <div className="blog-section-heading"><h2 id="blog-archive-title">تازه‌ترین نوشته‌ها</h2><span>THE LATEST NOTES</span></div>
          {rest.length ? <div className="blog-post-grid" id="blog-post-grid">
            {rest.map((post) => <BlogPostCard key={post.slug} post={post} />)}
          </div> : <div className="blog-empty">هنوز مقاله‌ای منتشر نشده. اولین نوشته به‌زودی اینجا قرار می‌گیره.</div>}
          {rest.length > 0 && <p className="blog-search-empty" id="blog-search-empty" hidden>مقاله‌ای با این عبارت پیدا نشد.</p>}
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema).replace(/</g, "\\u003c") }} />
      <script src="/blog-ui.js" defer />
    </BlogFrame>
  );
}
