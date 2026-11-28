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
            <svg className="blog-brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <rect x="1.5" y="1.5" width="45" height="45" rx="12.5" fill="#782C44" />
              <text x="23.5" y="25.5" fill="#FBFBF7" fontFamily="Estedad, sans-serif" fontSize="28" fontWeight="750" textAnchor="middle" dominantBaseline="middle">آ</text>
              <circle cx="38.5" cy="9.5" r="2.8" fill="#E3B72F" />
            </svg>
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
