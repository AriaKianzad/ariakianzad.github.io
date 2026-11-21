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

// Escape "<" so future text values cannot terminate the JSON-LD script element.
const structuredDataJson = JSON.stringify(structuredData).replace(/</g, "\\u003c");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${estedad.variable} ${geistMono.variable}`}>
      <head>
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self'; img-src 'self' data: https://www.google-analytics.com; font-src 'self'; connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com; object-src 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests" />
      </head>
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
        <section
          id="analytics-consent"
          className="analytics-consent"
          role="dialog"
          aria-label="Analytics preferences"
          aria-describedby="analytics-consent-description"
          hidden
        >
          <div className="analytics-consent__copy">
            <strong id="analytics-consent-title">Analytics preferences</strong>
            <p id="analytics-consent-description">
              We use Google Analytics to understand site traffic and improve the experience. Allow analytics to share usage data with Google.
            </p>
          </div>
          <div className="analytics-consent__actions">
            <button id="analytics-consent-accept" className="analytics-consent__accept" type="button">
              Allow analytics
            </button>
            <button id="analytics-consent-reject" className="analytics-consent__reject" type="button">
              Decline
            </button>
          </div>
        </section>
        <button id="analytics-preferences" className="analytics-preferences" type="button" hidden>
          Privacy settings
        </button>
        <script src="/analytics-consent.js" defer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredDataJson }}
        />
      </body>
    </html>
  );
}
