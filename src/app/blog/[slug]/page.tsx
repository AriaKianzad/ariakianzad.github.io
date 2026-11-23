import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { site } from "@/lib/site";
import { getBlogPost, getBlogPosts, getBlogSettings, readingTime, getBlogCategoryName, getPostCategorySlugs, getPrimaryCategorySlug } from "@/lib/blog-data";
import { extractToc, extractMarkdownImageUrls, renderMarkdown } from "@/lib/blog-markdown";
import { BlogHeader, BlogFooter } from "../BlogHeader";
import { CopyLinkButton } from "../CopyLinkButton";
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
  const image = post.og_image_url || post.hero_image_url || settings.default_og_image || site.url + "/og/blog/" + post.slug + ".jpg";
  const description = post.meta_description || post.excerpt || settings.default_meta_description;
  const robotsIndex = post.robots_index !== false && settings.default_robots_index !== false;
  const robotsFollow = post.robots_follow !== false && settings.default_robots_follow !== false;
  return {
    title: post.seo_title || post.title,
    description,
    alternates: { canonical },
    robots: {
      index: robotsIndex, follow: robotsFollow,
      googleBot: { index: robotsIndex, follow: robotsFollow, "max-image-preview": "large", "max-snippet": -1 },
    },
    openGraph: settings.open_graph_enabled ? {
      type: "article", siteName: "Aria Kianzad", url: canonical,
      title: post.og_title || settings.default_og_title || post.seo_title || post.title,
      description: post.og_description || settings.default_og_description || description,
      publishedTime: post.published_at, modifiedTime: post.updated_at,
      locale: post.language === "fa" ? "fa_IR" : "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: post.hero_image_alt || post.title }],
    } : undefined,
    twitter: {
      card: settings.twitter_card_type, title: post.og_title || settings.default_og_title || post.title,
      description: post.og_description || settings.default_og_description || description, images: [image],
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
            <div className="blog-eyebrow"><span /> آرشیو نوشته‌ها</div>
            <h1>هنوز مقاله‌ای برای نمایش وجود نداره.</h1>
            <p>بعد از انتشار اولین نوشته، صفحه‌های مقاله اینجا ساخته می‌شن.</p>
            <Link href="/blog/">بازگشت به همۀ یادداشت‌ها</Link>
          </section>
        </main>
        <BlogFooter />
      </>
    );
  }
  const toc = post.toc_enabled && settings.show_toc ? extractToc(post.content) : [];
  const html = renderMarkdown(post.content);
  const postCategories = getPostCategorySlugs(post);
  const primaryCategory = getPrimaryCategorySlug(post);
  const related = settings.show_related_posts
    ? getBlogPosts().filter((item) => item.slug !== post.slug && (
        getPostCategorySlugs(item).some((slug) => postCategories.includes(slug))
        || post.tags.some((tag) => item.tags.includes(tag))
      )).slice(0, 3)
    : [];
  const canonical = post.canonical_url || site.url + "/blog/" + post.slug + "/";
  const categoryName = primaryCategory ? getBlogCategoryName(primaryCategory) : "";
  const schema = {
    "@context": "https://schema.org", "@type": settings.schema_type,
    headline: post.title, description: post.meta_description || post.excerpt,
    datePublished: post.published_at, dateModified: post.updated_at,
    mainEntityOfPage: canonical,
    image: [...new Set([site.url + "/og/blog/" + post.slug + ".jpg", ...(post.hero_image_url ? [post.hero_image_url] : []), ...extractMarkdownImageUrls(post.content).map((url) => url.startsWith("/") ? site.url + url : url)])],
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
  const articleLineHeight = post.language === "fa" ? (settings.body_line_height || 1.95) : 1.7;
  const articleParagraphGap = post.language === "fa" ? articleLineHeight * 1.05 : 1.45;
  const articleStyle = {
    "--post-accent": post.accent_color || settings.accent_color,
    "--blog-line-height": articleLineHeight,
    "--blog-paragraph-gap": articleParagraphGap + "em",
  } as CSSProperties;
  return (
    <>
      <BlogHeader />
      <main className="blog-article-main" lang={language} dir={direction} style={articleStyle}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
        {faqSchema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} /> : null}
        {settings.breadcrumbs_enabled ? (
          <nav className="blog-container blog-breadcrumbs" aria-label="مسیر راهنما">
            <Link href="/blog/">{settings.breadcrumb_home_label || "خانه"}</Link>
            <span aria-hidden="true">/</span>
            {primaryCategory ? <Link href={"/blog/category/" + encodeURIComponent(primaryCategory) + "/"}>{categoryName}</Link> : <span>مقاله</span>}
          </nav>
        ) : null}
        <header className="blog-article-header">
          <div className="blog-container blog-article-header-grid">
            <div className="blog-article-copy" dir={direction}>
              <h1><span className="blog-article-title-highlight">{post.title}</span></h1>
              {post.excerpt ? <p className="blog-article-excerpt">{post.excerpt}</p> : null}
            </div>
            {post.hero_image_url ? (
              <figure className="blog-hero-image">
                <img src={post.hero_image_url} alt={post.hero_image_alt || ""} fetchPriority="high" />
                {post.hero_image_caption ? <figcaption>{post.hero_image_caption}</figcaption> : null}
              </figure>
            ) : <div className="blog-article-visual-empty" aria-hidden="true" />}
            <div className="blog-article-meta">
              <span>آریا کیانزاد</span>
              <time dateTime={post.published_at} dir={direction}>{new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-US", {year:"numeric",month:"long",day:"numeric",timeZone:language==="fa"?"Asia/Tehran":"UTC"}).format(new Date(post.published_at))}</time>
              {settings.show_reading_time ? <span className="blog-reading-time" dir={direction}><bdi>{readingTime(post.content, post.language).toLocaleString(language === "fa" ? "fa-IR" : "en-US")}</bdi> {language === "fa" ? "دقیقه مطالعه" : "min read"}</span> : null}
            </div>
          </div>
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
            <CopyLinkButton url={canonical} />
            <a href={"https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(canonical)} target="_blank" rel="noopener noreferrer">لینکدین ↗</a>
            <a href={"https://x.com/intent/post?url=" + encodeURIComponent(canonical)} target="_blank" rel="noopener noreferrer">ایکس ↗</a>
          </div>
        ) : null}
        {related.length ? (
          <section className="blog-related blog-container">
            <div className="blog-section-heading"><div><span className="blog-section-label"><span>۰۳</span> مرتبط</span><h2>نوشته‌های مرتبط</h2></div></div>
            <div className="blog-card-grid">{related.map((item) => <BlogPostCard key={item.slug} post={item} categoryName={item.category ? getBlogCategoryName(item.category) : ""} showReadingTime={settings.show_reading_time} />)}</div>
          </section>
        ) : null}
      </main>
      <BlogFooter />
    </>
  );
}
