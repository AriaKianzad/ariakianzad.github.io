import Link from "next/link";
import { getBlogSettings } from "@/lib/blog-data";
import { socials } from "@/lib/site";
import { SocialIcon } from "@/components/icons";

const socialLabels: Record<string, string> = {
  youtube: "یوتیوب", instagram: "اینستاگرام", linkedin: "لینکدین", x: "ایکس", unsplash: "آنسپلیش", telegram: "تلگرام",
};

export function BlogHeader() {
  return (
    <>
      <a className="blog-skip-link" href="#main">رفتن به محتوای اصلی</a>
      <header className="blog-header" dir="rtl">
      <div className="blog-container blog-header-inner">
        <Link className="blog-header-blog-link" href="/blog/" aria-label="وبلاگ آریا کیانزاد">
          <span className="blog-brand-mark" aria-hidden="true">آ</span>
          <span>آریا کیانزاد</span>
        </Link>
        <Link className="blog-back-link" href="/">
          وب‌سایت اصلی <span aria-hidden="true">↗</span>
        </Link>
      </div>
      </header>
    </>
  );
}

export function BlogFooter() {
  const settings = getBlogSettings();
  return (
    <footer className="blog-footer" dir="rtl">
      <div className="blog-container blog-footer-inner">
        <div className="blog-footer-main">
          <h2>بعضی سؤال‌ها با یک جواب تموم نمی‌شن.</h2>
          <p>{settings.footer_note || "من اینجا درباره برند، معنا و ارتباط می‌نویسم؛ از چیزهایی که در کارم می‌بینم تا سؤال‌هایی که هنوز جواب قطعی براشون ندارم."}</p>
        </div>
        <div className="blog-footer-side">
          <nav className="blog-footer-links" aria-label="پیوندهای وبلاگ">
            <Link href="/blog/">همۀ نوشته‌ها</Link>
            <Link href="/blog/contact/">تماس با من</Link>
            {settings.enable_rss ? <a href="/blog/feed.xml">فید وبلاگ</a> : null}
            <Link href="/">وب‌سایت اصلی</Link>
          </nav>
          <div className="blog-socials" aria-label="شبکه‌های اجتماعی">
            {socials.map((entry) => (
              <a key={entry.id} href={entry.href} target="_blank" rel="noopener noreferrer" aria-label={socialLabels[entry.id] || "شبکۀ اجتماعی"} title={socialLabels[entry.id] || "شبکۀ اجتماعی"}>
                <SocialIcon id={entry.id} />
              </a>
            ))}
          </div>
        </div>
        <div className="blog-footer-bottom">
          <small>© {new Date().toLocaleDateString("fa-IR", { year: "numeric" })} آریا کیانزاد</small>
          <span>این نوشته‌ها رو از نگاه و تجربهٔ خودم می‌نویسم.</span>
        </div>
      </div>
    </footer>
  );
}
