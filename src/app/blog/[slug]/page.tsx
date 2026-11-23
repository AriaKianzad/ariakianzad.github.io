import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogFrame } from "@/components/blog-frame";
import {
  extractHeadings, formatBlogDate, getBlogPost, getBlogSettings,
  getPublishedPosts, readingTime, renderMarkdown,
} from "@/lib/blog-content";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getPublishedPosts()).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return {};
  const title = post.seoTitle || post.title;
  const description = post.metaDescription || post.excerpt;
  const canonical = post.canonicalUrl || "/blog/" + post.slug + "/";
  const image = post.ogImageUrl || post.heroImageUrl || undefined;
  return {
    title,
    description,
    keywords: [post.focusKeyword, ...post.tags].filter(Boolean),
    alternates: { canonical },
    robots: {
      index: post.robotsIndex !== false,
      follow: post.robotsFollow !== false,
      googleBot: {
        index: post.robotsIndex !== false,
        follow: post.robotsFollow !== false,
        "max-image-preview": "large",
      },
    },
    openGraph: {
      type: "article",
      title: post.ogTitle || title,
      description: post.ogDescription || description,
      url: canonical,
      publishedTime: post.publishedAt,
      section: post.category,
      tags: post.tags,
      images: image ? [{ url: image, alt: post.heroImageAlt || title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.ogTitle || title,
      description: post.ogDescription || description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, settings, allPosts] = await Promise.all([
    getBlogPost(slug), getBlogSettings(), getPublishedPosts(),
  ]);
  if (!post) notFound();

  const headings = post.tocEnabled !== false ? extractHeadings(post.content) : [];
  const minutes = readingTime(post.content, post.language);
  const related = allPosts
    .filter((item) => item.slug !== post.slug &&
      (item.category === post.category || item.tags.some((tag) => post.tags.includes(tag))))
    .slice(0, 3);
  const canonical = post.canonicalUrl || "https://ariakianzad.github.io/blog/" + post.slug + "/";
  const image = post.ogImageUrl || post.heroImageUrl;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    headline: post.title,
    description: post.metaDescription || post.excerpt,
    image: image ? [image] : undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    inLanguage: post.language === "en" ? "en" : "fa-IR",
    articleSection: post.category,
    keywords: [post.focusKeyword, ...post.tags].filter(Boolean).join(", "),
    publisher: { "@type": "Person", name: "Aria Kianzad", url: "https://ariakianzad.github.io/" },
    author: { "@type": "Person", name: "Aria Kianzad", url: "https://ariakianzad.github.io/" },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "نوشته‌ها", item: "https://ariakianzad.github.io/blog/" },
      { "@type": "ListItem", position: 2, name: post.category, item: "https://ariakianzad.github.io/blog/category/" + encodeURIComponent(post.category) + "/" },
      { "@type": "ListItem", position: 3, name: post.title, item: canonical },
    ],
  };
  const faqSchema = post.faqs?.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  return (
    <BlogFrame settings={settings}>
      <main>
        <article lang={post.language === "en" ? "en" : "fa"} dir={post.language === "en" ? "ltr" : "rtl"}>
          <header className="blog-article-top">
            <nav className="blog-breadcrumbs" aria-label="مسیر صفحه">
              <Link href="/blog/">نوشته‌ها</Link><span>/</span>
              <Link href={"/blog/category/" + encodeURIComponent(post.category) + "/"}>{post.category}</Link>
            </nav>
            <p className="blog-article-category">{post.category}</p>
            <h1>{post.title}</h1>
            <p className="blog-article-excerpt">{post.excerpt}</p>
            <div className="blog-article-meta">
              {post.publishedAt && <time dateTime={post.publishedAt}>
                {formatBlogDate(post.publishedAt, post.language === "en" ? "en-US" : "fa-IR")}
              </time>}
              {settings.showReadingTime && <span>{minutes} دقیقه مطالعه</span>}
              {post.tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}
            </div>
            {post.heroImageUrl && <figure className="blog-hero-image">
              <img src={post.heroImageUrl} alt={post.heroImageAlt || ""} fetchPriority="high" />
              {post.heroImageCaption && <figcaption>{post.heroImageCaption}</figcaption>}
            </figure>}
          </header>
          <div className="blog-reading-layout">
            {headings.length > 1 && <aside className="blog-toc" aria-label="فهرست مطالب">
              <strong>در این مقاله</strong>
              <ul>{headings.map((heading) => (
                <li key={heading.id} data-level={heading.level}><a href={"#" + heading.id}>{heading.title}</a></li>
              ))}</ul>
            </aside>}
            <div className={"blog-article-content" +
              (post.contentWidth === "wide" ? " blog-content-wide" : "") +
              (post.dropCap ? " blog-drop-cap" : "")}>
              {renderMarkdown(post.content)}
              {post.faqs?.length ? <section className="blog-faqs" aria-labelledby="blog-faq-title">
                <h2 id="blog-faq-title">سؤالات متداول</h2>
                {post.faqs.map((faq, index) => <div className="blog-faq-item" key={index}>
                  <h3>{faq.question}</h3><p>{faq.answer}</p>
                </div>)}
              </section> : null}
            </div>
          </div>
        </article>
        {related.length > 0 && <section className="blog-related">
          <h2>مطالب مرتبط</h2>
          <div className="blog-related-grid">
            {related.map((item) => <Link key={item.slug} href={"/blog/" + item.slug + "/"}>{item.title} ↗</Link>)}
          </div>
        </section>}
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c") }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />}
    </BlogFrame>
  );
}
