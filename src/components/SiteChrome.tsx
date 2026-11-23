"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { site, socials, primaryNav } from "@/lib/site";
import { footer } from "@/content/home";
import { ExtArrow, SocialIcon } from "@/components/icons";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const isBlog = pathname === "/blog" || pathname.startsWith("/blog/");

  if (isBlog) return <>{children}</>;

  const siteHost = new URL(site.url).host;
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header" data-header>
        <div className="shell site-header__row">
          <a className="wordmark" href="/#top" aria-label="Aria Kianzad, home">
            <span className="wordmark__mark" aria-hidden="true">AK</span>
            <span className="wordmark__copy">
              <strong>Aria Kianzad</strong>
              <small>Brand strategy / Personal branding</small>
            </span>
          </a>
          <nav className="site-nav" aria-label="Primary" data-nav>
            <button className="menu-btn" type="button" aria-expanded="false" aria-controls="menu-list" data-menu-btn>
              <span className="menu-btn__label">Menu</span>
              <span className="menu-btn__icon" aria-hidden="true" />
            </button>
            <ul className="site-nav__list" id="menu-list">
              {primaryNav.map((item, index) => (
                <li key={item.href}>
                  <a className="site-nav__link" href={item.href} data-nav-link>
                    <span className="n" aria-hidden="true">{"0" + String(index + 1).padStart(2, "0")}</span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a className="header-cta" href={"mailto:" + site.email}>
            <span>Let&apos;s talk</span>
            <ExtArrow />
          </a>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="shell">
          <div className="site-footer__top">
            <div className="site-footer__identity">
              <a className="site-footer__wordmark" href="/#top">Aria Kianzad</a>
              <p>{footer.note}</p>
            </div>
            <div className="site-footer__links" aria-label="Related projects">
              <a href="https://rexo.agency/" target="_blank" rel="noopener noreferrer">Rexo <ExtArrow /></a>
              <a href="/Mian-e-Ma/">میانِ ما</a>
              <a href="mailto:kianzadaria@gmail.com">Email</a>
            </div>
          </div>
          <ul className="social-list" aria-label="Social profiles">
            {socials.map((entry) => (
              <li key={entry.id}>
                <a className="social-link" href={entry.href} target="_blank" rel="noopener noreferrer" aria-label={entry.label}>
                  <SocialIcon id={entry.id} />
                </a>
              </li>
            ))}
          </ul>
          <div className="site-footer__base">
            <p className="site-footer__legal">{footer.copyright}</p>
            <p className="site-footer__legal">{siteHost}</p>
            <a className="back-to-top" href="/#top">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </>
  );
}
