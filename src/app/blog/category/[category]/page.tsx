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
export async function generateMetadata({params}:{params:Promise<{category:string}>}):Promise<Metadata>{
  const {category}=await params;
  const item=getBlogCategories().find((entry)=>entry.slug===category);
  if(!item)return {title:"دسته‌بندی پیدا نشد | آریا کیانزاد",robots:{index:false,follow:false}};
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
  const settings=getBlogSettings();
  if(!item) {
    return (
      <>
        <BlogHeader />
        <main className="blog-main" dir="rtl">
          <section className="blog-container blog-category-heading">
            <div className="blog-eyebrow"><span /> دسته‌بندی نوشته‌ها</div>
            <h1>هنوز دسته‌بندی‌ای برای نمایش وجود نداره.</h1>
            <p>بعد از انتشار اولین مقاله، دسته‌بندی‌ها اینجا نمایش داده می‌شن.</p>
            <Link href="/blog/">بازگشت به نوشته‌ها</Link>
          </section>
        </main>
        <BlogFooter />
      </>
    );
  }
  const posts=getPostsByCategory(category);
  return (
    <>
      <BlogHeader />
      <main className="blog-main" dir="rtl">
        <section className="blog-container blog-category-heading">
          <div className="blog-eyebrow"><span /> CATEGORY / ARCHIVE</div>
          <h1>{item.name}</h1>
          <p>{posts.length.toLocaleString("fa-IR")} نوشته در این دسته‌بندی</p>
          <Link href="/blog/">← بازگشت به نوشته‌ها</Link>
        </section>
        <section className="blog-container blog-listing-section">
          <div className="blog-card-grid">{posts.map((post)=><BlogPostCard key={post.slug} post={post} showReadingTime={settings.show_reading_time}/>)}</div>
        </section>
      </main>
      <BlogFooter />
    </>
  );
}
