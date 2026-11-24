"use client";

import { usePathname } from "next/navigation";
import "./not-found.css";

export default function NotFoundContent() {
  const pathname = usePathname() || "/";
  const blogRoute = pathname === "/blog" || pathname.startsWith("/blog/");

  if (blogRoute) {
    return (
      <main className="not-found-page not-found-blog" lang="fa" dir="rtl">
        <div className="not-found-topline">
          <a className="not-found-brand" href="/blog/">
            <span className="not-found-mark">آ</span>
            <span><strong>یادداشت‌ها</strong><small>وبلاگ آریا کیانزاد</small></span>
          </a>
          <a className="not-found-back" href="/">وب‌سایت اصلی <span aria-hidden="true">↗</span></a>
        </div>
        <section className="not-found-content" aria-labelledby="not-found-title">
          <div className="not-found-number" aria-hidden="true">۴۰۴</div>
          <p className="not-found-eyebrow"><span /> این صفحه در آرشیو نیست</p>
          <h1 id="not-found-title">این آدرس به نوشته‌ای نمی‌رسه.</h1>
          <p className="not-found-description">
            ممکنه نشانی مقاله تغییر کرده باشه یا صفحه دیگه در دسترس نباشه. از آرشیو می‌تونی دوباره مسیرت رو پیدا کنی.
          </p>
          <div className="not-found-actions">
            <a className="not-found-primary" href="/blog/">بازگشت به نوشته‌ها <span aria-hidden="true">←</span></a>
            <a className="not-found-secondary" href="/">رفتن به وب‌سایت اصلی</a>
          </div>
        </section>
        <footer className="not-found-footer"><span>آریا کیانزاد</span><span>یادداشت‌هایی درباره برند، معنا و ارتباط</span></footer>
      </main>
    );
  }

  return (
    <main className="not-found-page not-found-main" dir="ltr">
      <div className="not-found-number" aria-hidden="true">404</div>
      <section className="not-found-content" aria-labelledby="not-found-title">
        <p className="not-found-eyebrow">PAGE NOT FOUND</p>
        <h1 id="not-found-title">That page doesn&apos;t exist.</h1>
        <p className="not-found-description">The address you followed isn&apos;t on this site.</p>
        <div className="not-found-actions">
          <a className="not-found-primary" href="/">Back to the main site <span aria-hidden="true">↗</span></a>
          <a className="not-found-secondary" href="/blog/">Visit the blog</a>
        </div>
      </section>
    </main>
  );
}
