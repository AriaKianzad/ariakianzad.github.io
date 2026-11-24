import type { Metadata } from "next";
import Link from "next/link";
import { BlogHeader, BlogFooter } from "./BlogHeader";

export const metadata: Metadata = {
  title: "صفحه پیدا نشد | وبلاگ آریا کیانزاد",
  description: "نشانی درخواستی به مقاله‌ای در وبلاگ نمی‌رسه.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: null },
};

export default function BlogNotFound() {
  return (
    <>
      <BlogHeader />
      <main className="blog-main" dir="rtl">
        <section className="blog-container blog-category-heading blog-not-found">
          <div className="blog-eyebrow"><span /> ۴۰۴ · صفحۀ موردنظر پیدا نشد</div>
          <h1>این آدرس به نوشته‌ای نمی‌رسه.</h1>
          <p>ممکنه نشانی مقاله تغییر کرده باشه یا صفحه دیگه در دسترس نباشه. از آرشیو می‌تونی دوباره مسیرت رو پیدا کنی.</p>
          <Link href="/blog/">بازگشت به نوشته‌ها ←</Link>
        </section>
      </main>
      <BlogFooter />
    </>
  );
}
