import Link from "next/link";
import { BlogHeader, BlogFooter } from "./BlogHeader";

export default function BlogNotFound() {
  return (
    <>
      <BlogHeader />
      <main id="main" tabIndex={-1} className="blog-main" dir="rtl">
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
