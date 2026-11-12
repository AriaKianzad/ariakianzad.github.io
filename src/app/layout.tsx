import type { Metadata, Viewport } from "next";
import { estedad, geistMono } from "./fonts";
import { rootMetadata } from "@/lib/metadata";
import { site, socials, primaryNav, knowsAbout, rexo } from "@/lib/site";
import { footer } from "@/content/home";
import { SocialIcon } from "@/components/icons";
import "./globals.css";
import "./chrome.css";
import "./sections.css";

export const metadata: Metadata = rootMetadata();

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  colorScheme: "dark",
};

/**
 * ProfilePage + Person structured data. Every value comes from src/lib/site;
 * nothing asserted here that the site does not show.
 */
const personId = `${site.url}/#person`;
const rexoId = `${rexo.url.replace(/\/$/, "")}/#organization`;
const siteHost = new URL(site.url).host;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfilePage",
      "@id": `${site.url}/#profilepage`,
      inLanguage: "en",
      mainEntity: { "@id": personId },
      about: { "@id": personId },
    },
    {
      "@type": "Person",
      "@id": personId,
      name: site.displayName,
      givenName: site.givenName,
      url: site.url,
      email: `mailto:${site.email}`,
      jobTitle: site.title,
      description: site.description,
      image: `${site.url}/og/og.png`,
      sameAs: socials.map((entry) => entry.href),
      knowsAbout: [...knowsAbout],
      worksFor: { "@id": rexoId },
    },
    {
      "@type": "Organization",
      "@id": rexoId,
      name: rexo.name,
      url: rexo.url,
      foundingDate: rexo.founded,
      description: rexo.description,
      founder: { "@id": personId },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${estedad.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {/* Synchronous on purpose: confirms scripting before first paint
            (see public/boot.js and the eslint config for the rationale). */}
        <script src="/boot.js" />
        {/* Enhancement layer: menu, scroll spy, reveals, copy email. */}
        <script src="/ui.js" defer />
        <header className="site-header" data-header>
          <div className="shell site-header__row">
            <a className="wordmark" href="/#top">
              Aria Kianzad
            </a>
            <nav className="site-nav" aria-label="Primary" data-nav>
              <button
                className="menu-btn"
                type="button"
                aria-expanded="false"
                aria-controls="menu-list"
                data-menu-btn
              >
                <span className="menu-btn__label">Menu</span>
                <span className="menu-btn__icon" aria-hidden="true" />
              </button>
              <ul className="site-nav__list" id="menu-list">
                {primaryNav.map((item, index) => (
                  <li key={item.href}>
                    <a className="site-nav__link" href={item.href} data-nav-link>
                      <span className="n" aria-hidden="true">{`0${index + 1}`}</span>
                      {item.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    className="site-nav__link site-nav__contact"
                    href={`mailto:${site.email}`}
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="shell">
            <div className="site-footer__row">
              <a className="site-footer__wordmark" href="/#top">
                Aria Kianzad
              </a>
              <p className="site-footer__meta">{footer.note}</p>
            </div>
            <ul className="social-list">
              {socials.map((entry) => (
                <li key={entry.id}>
                  <a
                    className="social-link"
                    href={entry.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={entry.label}
                  >
                    <SocialIcon id={entry.id} />
                  </a>
                </li>
              ))}
            </ul>
            <div className="site-footer__base">
              <p className="site-footer__legal">{footer.copyright}</p>
              <p className="site-footer__legal">{siteHost}</p>
            </div>
          </div>
        </footer>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
