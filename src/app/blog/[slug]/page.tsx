import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { site } from "@/lib/site";
import { getBlogPost, getBlogPosts, getBlogSettings, readingTime } from "@/lib/blog-data";
import { extractToc, renderMarkdown } from "@/lib/blog-markdown";
import { BlogHeader, BlogFooter } from "../BlogHeader";
import { BlogPostCard } from "../BlogListingClient";

export const dynamicParams = false;

export function generateStaticParams() {
  const posts = getBlogPosts();
  return posts.length
    ? posts.map((post) => ({ slug: post.slug }))
    : [{ slug: "__empty__" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "مقاله پیدا نشد | آریا کیانزاد", robots: { index: false, follow: false } };
  const settings = getBlogSettings();
  const canonical = post.canonical_url || site.url + "/blog/" + post.slug + "/";
  const image = site.url + "/og/blog/" + post.slug + ".jpg";
  const description = post.meta_description || post.excerpt || settings.default_meta_description;
  return {
    title: post.seo_title || post.title,
    description,
    alternates: { canonical },
    robots: {
      index: post.robots_index, follow: post.robots_follow,
      googleBot: { index: post.robots_index, follow: post.robots_follow, "max-image-preview": "large", "max-snippet": -1 },
    },
    openGraph: {
      type: "article", siteName: "Aria Kianzad", url: canonical,
      title: post.og_title || post.seo_title || post.title,
      description: post.og_description || description,
      publishedTime: post.published_at, modifiedTime: post.updated_at,
      locale: post.language === "fa" ? "fa_IR" : "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: post.hero_image_alt || post.title }],
    },
    twitter: {
      card: "summary_large_image", title: post.og_title || post.title,
      description: post.og_description || description, images: [image],
    },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  const settings = getBlogSettings();
  if (!post) {
    return (
      <>
        <BlogHeader />
        <main className="blog-article-main" dir="rtl">
          <section className="blog-container blog-category-heading">
            <div className="blog-eyebrow"><span /> ARTICLE / ARCHIVE</div>
            <h1>هنوز مقاله‌ای برای نمایش وجود نداره.</h1>
            <p>بعد از انتشار اولین نوشته، صفحه‌های مقاله اینجا ساخته می‌شن.</p>
            <Link href="/blog/">بازگشت به همۀ نوشته‌ها</Link>
          </section>
        </main>
        <BlogFooter />
      </>
    );
  }
  const toc = post.toc_enabled && settings.show_toc ? extractToc(post.content) : [];
  const html = renderMarkdown(post.content);
  const related = settings.show_related_posts
    ? getBlogPosts().filter((item) => item.slug !== post.slug && (item.category === post.category || post.tags.some((tag) => item.tags.includes(tag)))).slice(0, 3)
    : [];
  const canonical = post.canonical_url || site.url + "/blog/" + post.slug + "/";
  const schema = {
    "@context": "https://schema.org", "@type": "Article",
    headline: post.title, description: post.meta_description || post.excerpt,
    datePublished: post.published_at, dateModified: post.updated_at,
    mainEntityOfPage: canonical, image: [site.url + "/og/blog/" + post.slug + ".jpg"],
    author: { "@type": "Person", name: "Aria Kianzad", url: site.url },
    publisher: { "@type": "Person", name: "Aria Kianzad", url: site.url },
    inLanguage: post.language === "fa" ? "fa-IR" : "en",
    keywords: [post.focus_keyword, ...(post.tags || [])].filter(Boolean).join(", "),
  };
  const faqSchema = post.faqs?.length ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: post.faqs.map((faq) => ({
      "@type": "Question", name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;
  const language = post.language === "fa" ? "fa" : "en";
  const direction = post.language === "fa" ? "rtl" : "ltr";
  const articleStyle = { "--post-accent": post.accent_color || settings.accent_color } as CSSProperties;
  return (
    <>
      <BlogHeader />
      <main className="blog-article-main" lang={language} dir={direction} style={articleStyle}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
        {faqSchema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} /> : null}
        <div className="blog-container blog-breadcrumbs">
          <Link href="/blog/">یادداشت‌ها</Link><span aria-hidden="true">/</span>
          {post.category ? <Link href={"/blog/category/" + encodeURIComponent(post.category.toLowerCase().replace(/\s+/g, "-")) + "/"}>{post.category}</Link> : <span>مقاله</span>}
        </div>
        <header className="blog-article-header blog-container">
          <div className="blog-eyebrow"><span /> {post.category || "یادداشت"}</div>
          <h1>{post.title}</h1>
          {post.excerpt ? <p className="blog-article-excerpt">{post.excerpt}</p> : null}
          <div className="blog-article-meta">
            <span>آریا کیانزاد</span>
            <time dateTime={post.published_at}>{new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-US", {year:"numeric",month:"long",day:"numeric",timeZone:language==="fa"?"Asia/Tehran":"UTC"}).format(new Date(post.published_at))}</time>
            {settings.show_reading_time ? <span>{readingTime(post.content, post.language)} دقیقه مطالعه</span> : null}
          </div>
          {post.hero_image_url ? (
            <figure className="blog-hero-image">
              <img src={post.hero_image_url} alt={post.hero_image_alt || ""} fetchPriority="high" />
              {post.hero_image_caption ? <figcaption>{post.hero_image_caption}</figcaption> : null}
            </figure>
          ) : null}
        </header>
        <div className={"blog-article-grid blog-container" + (toc.length ? " has-toc" : " no-toc") + (post.content_width === "wide" || settings.content_width === "wide" ? " content-wide" : "")}>
          {toc.length ? (
            <aside className="blog-toc">
              <strong>در این مقاله</strong>
              <ol>{toc.map((item) => <li key={item.id} className={item.level === 3 ? "toc-sub" : ""}><a href={"#" + item.id}>{item.title}</a></li>)}</ol>
            </aside>
          ) : null}
          <article className={"blog-prose" + (post.drop_cap ? " has-drop-cap" : "")} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        {post.faqs?.length ? (
          <section className="blog-faq blog-container">
            <h2>پرسش‌های متداول</h2>
            {post.faqs.map((faq, i) => <details key={i}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
          </section>
        ) : null}
        {post.tags?.length ? <div className="blog-tags blog-container">{post.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
        {settings.show_share ? (
          <div className="blog-share blog-container">
            <span>این نوشته رو به اشتراک بذار</span>
            <a href={"https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(canonical)} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
            <a href={"https://x.com/intent/post?url=" + encodeURIComponent(canonical)} target="_blank" rel="noopener noreferrer">X ↗</a>
            <a href={"mailto:?subject=" + encodeURIComponent(post.title) + "&body=" + encodeURIComponent(canonical)}>Email ↗</a>
          </div>
        ) : null}
        {related.length ? (
          <section className="blog-related blog-container">
            <div className="blog-section-heading"><div><span className="blog-section-label"><span>۰۳</span> مرتبط</span><h2>نوشته‌های مرتبط</h2></div></div>
            <div className="blog-card-grid">{related.map((item) => <BlogPostCard key={item.slug} post={item} showReadingTime={settings.show_reading_time} />)}</div>
          </section>
        ) : null}
      </main>
      <BlogFooter />
    </>
  );
}
