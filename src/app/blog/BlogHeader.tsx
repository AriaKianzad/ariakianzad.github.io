import Link from "next/link";
import { getBlogSettings } from "@/lib/blog-data";

export function BlogHeader() {
  return (
    <header className="blog-header">
      <div className="blog-container blog-header-inner">
        <Link className="blog-brand" href="/blog/" aria-label="یادداشت‌های آریا کیانزاد">
          <span className="blog-brand-mark" aria-hidden="true">AK</span>
          <span className="blog-brand-copy">
            <strong>آریا کیانزاد</strong>
            <small>یادداشت‌هایی از زاویۀ من</small>
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
        <div className="blog-footer-main">
          <span className="blog-footer-kicker">NOTES / THOUGHTS / PERSPECTIVES</span>
          <h2>بعضی سؤال‌ها با یک جواب تموم نمی‌شن.</h2>
          <p>{settings.footer_note || "من اینجا درباره برند، معنا و ارتباط می‌نویسم؛ از چیزهایی که در کارم می‌بینم تا سؤال‌هایی که هنوز جواب قطعی براشون ندارم."}</p>
        </div>
        <div className="blog-footer-links">
          <Link href="/blog/">همۀ نوشته‌ها</Link>
          <Link href="/#about">دربارۀ من</Link>
          {settings.enable_rss ? <a href="/blog/feed.xml">فید RSS</a> : null}
          <a href="mailto:kianzadaria@gmail.com">ایمیل</a>
        </div>
        <div className="blog-footer-bottom">
          <small>© {new Date().getFullYear()} Aria Kianzad</small>
          <span>این نوشته‌ها رو از نگاه و تجربهٔ خودم می‌نویسم.</span>
        </div>
      </div>
    </footer>
  );
}
