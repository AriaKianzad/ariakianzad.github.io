import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogFrame } from "@/components/blog-frame";
import { BlogPostCard } from "@/components/blog-post-card";
import { BlogPagination } from "@/components/blog-pagination";
import { getBlogSettings, getPublishedPosts } from "@/lib/blog-content";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const [posts, settings] = await Promise.all([getPublishedPosts(), getBlogSettings()]);
  const featured = settings.showFeatured ? posts.find((post) => post.featured) : undefined;
  const count = posts.filter((post) => post.slug !== featured?.slug).length;
  const pages = Math.ceil(count / settings.postsPerPage);
  return Array.from({ length: Math.max(0, pages - 1) }, (_, index) => ({ page: String(index + 2) }));
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  return {
    title: "نوشته‌ها؛ صفحۀ " + page + " | وبلاگ آریا کیانزاد",
    description: "آرشیو مقاله‌ها و یادداشت‌های آریا کیانزاد.",
    alternates: { canonical: "/blog/page/" + page + "/" },
  };
}

export default async function BlogArchivePageNumber({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const currentPage = Number(page);
  const [posts, settings] = await Promise.all([getPublishedPosts(), getBlogSettings()]);
  const featured = settings.showFeatured ? posts.find((post) => post.featured) : undefined;
  const rest = posts.filter((post) => post.slug !== featured?.slug);
  const totalPages = Math.max(1, Math.ceil(rest.length / settings.postsPerPage));
  if (!Number.isInteger(currentPage) || currentPage < 2 || currentPage > totalPages) notFound();
  const visiblePosts = rest.slice((currentPage - 1) * settings.postsPerPage, currentPage * settings.postsPerPage);

  return (
    <BlogFrame settings={settings}>
      <main className="blog-archive">
        <div className="blog-hero">
          <div className="blog-breadcrumbs"><Link href="/blog/">نوشته‌ها</Link><span>/</span>
            <span>صفحۀ {new Intl.NumberFormat("fa-IR").format(currentPage)}</span></div>
          <h1>{settings.title}</h1>
          <p>آرشیو مقاله‌ها و یادداشت‌ها</p>
        </div>
        <div className="blog-post-grid">
          {visiblePosts.map((post) => <BlogPostCard key={post.slug} post={post} showReadingTime={settings.showReadingTime} />)}
        </div>
        <BlogPagination currentPage={currentPage} totalPages={totalPages} />
      </main>
    </BlogFrame>
  );
}
