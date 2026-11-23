import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogFrame } from "@/components/blog-frame";
import { BlogPostCard } from "@/components/blog-post-card";
import { getBlogCategories, getBlogSettings, getPublishedPosts } from "@/lib/blog-content";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const categories = await getBlogCategories();
  return categories.map((category) => ({ category: category.name }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const title = category + " | وبلاگ آریا کیانزاد";
  const description = "مقاله‌ها و یادداشت‌های مرتبط با " + category + " در وبلاگ آریا کیانزاد.";
  return { title, description, alternates: { canonical: "/blog/category/" + encodeURIComponent(category) + "/" } };
}

export default async function BlogCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const [posts, settings, categories] = await Promise.all([
    getPublishedPosts(), getBlogSettings(), getBlogCategories(),
  ]);
  const matching = posts.filter((post) => post.category === category);
  if (!matching.length || !categories.some((item) => item.name === category)) notFound();

  return (
    <BlogFrame settings={settings}>
      <main className="blog-archive">
        <div className="blog-hero">
          <div className="blog-breadcrumbs"><Link href="/blog/">نوشته‌ها</Link><span>/</span><span>{category}</span></div>
          <h1>{category}</h1><p>{matching.length} مقاله در این دسته‌بندی</p>
        </div>
        <nav className="blog-categories" aria-label="دسته‌بندی مقاله‌ها">
          <Link href="/blog/">همهٔ نوشته‌ها</Link>
          {categories.map((item) => <Link className={item.name === category ? "is-active" : ""} key={item.name}
            href={"/blog/category/" + encodeURIComponent(item.name) + "/"}>{item.name}</Link>)}
        </nav>
        <div className="blog-post-grid">
          {matching.map((post) => <BlogPostCard key={post.slug} post={post} />)}
        </div>
      </main>
    </BlogFrame>
  );
}
