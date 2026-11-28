import Link from "next/link";
import { getBlogSettings } from "@/lib/blog-data";
import { socials } from "@/lib/site";
import { SocialIcon } from "@/components/icons";

function BlogSocialIcon({ id }: { id: string }) {
  if (id !== "telegram") return <SocialIcon id={id} />;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="blog-brand-mark" src="/brand-logo.png?v=20261128-1" alt="" aria-hidden="true" width="38" height="38" decoding="async" />
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
                <BlogSocialIcon id={entry.id} />
              </a>
            ))}
          </div>
        </div>
        <div className="blog-footer-bottom">
          <small>© {new Date().toLocaleDateString("fa-IR", { year: "numeric", timeZone: "Asia/Tehran" })} آریا کیانزاد</small>
          <span>این نوشته‌ها رو از نگاه و تجربهٔ خودم می‌نویسم.</span>
        </div>
      </div>
    </footer>
  );
}
