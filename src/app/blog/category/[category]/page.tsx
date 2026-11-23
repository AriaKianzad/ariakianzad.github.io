import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogCategories, getPostsByCategory } from "@/lib/blog-data";
import { site } from "@/lib/site";
import { BlogHeader, BlogFooter } from "../../BlogHeader";
import { BlogPostCard } from "../../BlogListingClient";

export const dynamicParams = false;
export function generateStaticParams() {
  return getBlogCategories().map((category) => ({ category: category.slug }));
}
export async function generateMetadata({params}:{params:Promise<{category:string}>}):Promise<Metadata>{
  const {category}=await params;
  const item=getBlogCategories().find((entry)=>entry.slug===category);
  if(!item)return {};
  return {
    title:item.name+" | نوشته‌های آریا کیانزاد",
    description:"مقاله‌ها و یادداشت‌های مربوط به "+item.name+" در وبلاگ آریا کیانزاد.",
    alternates:{canonical:site.url+"/blog/category/"+encodeURIComponent(category)+"/"},
    robots:{index:true,follow:true},
  };
}
export default async function BlogCategoryPage({params}:{params:Promise<{category:string}>}){
  const {category}=await params;
  const item=getBlogCategories().find((entry)=>entry.slug===category);
  if(!item)notFound();
  const posts=getPostsByCategory(category);
  return (
    <>
      <BlogHeader />
      <main className="blog-main" dir="rtl">
        <section className="blog-container blog-category-heading">
          <div className="blog-eyebrow"><span /> CATEGORY / ARCHIVE</div>
          <h1>{item.name}</h1>
          <p>{posts.length.toLocaleString("fa-IR")} نوشته در این دسته‌بندی</p>
          <Link href="/blog/">← بازگشت به همۀ نوشته‌ها</Link>
        </section>
        <section className="blog-container blog-listing-section">
          <div className="blog-card-grid">{posts.map((post)=><BlogPostCard key={post.slug} post={post}/>)}</div>
        </section>
      </main>
      <BlogFooter />
    </>
  );
}
