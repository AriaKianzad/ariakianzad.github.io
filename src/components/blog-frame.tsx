import Link from "next/link";
import type { ReactNode } from "react";
import type { BlogSettings } from "@/lib/blog-content";

export function BlogFrame({ children, settings }: { children: ReactNode; settings: BlogSettings }) {
  const theme = settings.backgroundTheme === "white"
    ? "blog-theme-white" : settings.backgroundTheme === "warm" ? "blog-theme-warm" : "blog-theme-paper";
  const accent = ({
    "#405a42": "blog-accent-forest",
    "#737443": "blog-accent-olive",
    "#a45c45": "blog-accent-terracotta",
    "#435b75": "blog-accent-navy",
    "#765b77": "blog-accent-plum",
  } as Record<string, string>)[settings.accentColor.toLowerCase()] || "blog-accent-forest";

  return (
    <div className={"blog-surface " + theme + " " + accent + " blog-cards-" + settings.cardStyle}>
      <div className="blog-shell">
        <header className="blog-header">
          <Link className="blog-brand" href="/blog/" aria-label="وبلاگ آریا کیانزاد">
            <span className="blog-brand-mark">AK</span>
            <span><strong>آریا کیانزاد</strong><small>یادداشت‌ها و مقاله‌ها</small></span>
          </Link>
          <nav className="blog-header-nav" aria-label="مسیرهای اصلی">
            <Link href="/blog/">نوشته‌ها</Link>
            <Link href="/#about">دربارۀ من</Link>
            <Link href="/#contact">ارتباط</Link>
          </nav>
          <Link className="blog-back-link" href="/">بازگشت به سایت اصلی <span aria-hidden="true">↗</span></Link>
        </header>
        {children}
        <footer className="blog-footer">
          <div><strong>{settings.title}</strong><p>{settings.footerNote}</p></div>
          <div className="blog-footer-links">
            <Link href="/blog/">همۀ نوشته‌ها</Link>
            <Link href="/#top">وب‌سایت شخصی</Link>
            <a href="https://x.com/ariakianzad" target="_blank" rel="noopener noreferrer">X</a>
            <a href="https://www.linkedin.com/in/ariakianzad" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </div>
          <span className="blog-footer-copy">© {new Date().getFullYear()} ARIA KIANZAD</span>
        </footer>
      </div>
    </div>
  );
}
