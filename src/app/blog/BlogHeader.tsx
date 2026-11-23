import Link from "next/link";
import { getBlogSettings } from "@/lib/blog-data";

export function BlogHeader() {
  const settings = getBlogSettings();
  return (
    <header className="blog-header">
      <div className="blog-container blog-header-inner">
        <Link className="blog-brand" href="/blog/" aria-label="وبلاگ آریا کیانزاد">
          <span className="blog-brand-mark">AK</span>
          <span className="blog-brand-copy">
            <strong>آریا کیانزاد</strong>
            <small>یادداشت‌ها و مقاله‌ها</small>
          </span>
        </Link>
        <nav className="blog-header-nav" aria-label="مسیرهای وبلاگ">
          <Link href="/blog/">همۀ نوشته‌ها</Link>
          <Link href="/#about">دربارۀ من</Link>
          <Link href="/#contact">ارتباط</Link>
        </nav>
        <Link className="blog-back-link" href="/">وب‌سایت اصلی <span aria-hidden="true">↗</span></Link>
      </div>
    </header>
  );
}

export function BlogFooter() {
  const settings = getBlogSettings();
  return (
    <footer className="blog-footer">
      <div className="blog-container blog-footer-inner">
        <div>
          <strong>آریا کیانزاد</strong>
          <p>{settings.footer_note || "استراتژی برند / جایگاه‌یابی / ارتباطات"}</p>
        </div>
        <div className="blog-footer-links">
          <Link href="/blog/">بلاگ</Link>
          <Link href="/">وب‌سایت اصلی</Link>
          {settings.enable_rss ? <a href="/blog/feed.xml">RSS</a> : null}
          <a href="mailto:kianzadaria@gmail.com">ایمیل</a>
        </div>
        <small>© {new Date().getFullYear()} Aria Kianzad</small>
      </div>
    </footer>
  );
}
