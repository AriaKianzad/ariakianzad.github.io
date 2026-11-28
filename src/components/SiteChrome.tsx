"use client";

import type { ReactNode } from "react";
import Image from "next/image";
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
            <Image className="wordmark__mark" src="/brand-logo.png?v=20261128-1" alt="" aria-hidden={true} width={42} height={42} unoptimized />
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
      <main id="main" tabIndex={-1}>{children}</main>
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
            {pathname === "/" && (
              <li>
                <a className="social-link github-social-link" href="https://github.com/AriaKianzad" target="_blank" rel="noopener noreferrer" aria-label="Aria Kianzad on GitHub">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                    <path d="M12 .297a12 12 0 0 0-3.797 23.383c.6.111.82-.261.82-.577v-2.234c-3.338.726-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.419-1.305.762-1.605-2.665-.304-5.467-1.332-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.5 11.5 0 0 1 6.005 0c2.291-1.552 3.297-1.23 3.297-1.23.655 1.652.243 2.873.12 3.176.77.84 1.234 1.91 1.234 3.221 0 4.61-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.216.694.825.576A12.004 12.004 0 0 0 12 .297z" />
                  </svg>
                </a>
              </li>
            )}
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
