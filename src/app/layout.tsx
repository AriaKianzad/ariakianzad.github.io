import type { Metadata, Viewport } from "next";
import { estedad, geistMono } from "./fonts";
import { rootMetadata } from "@/lib/metadata";
import { site, socials, knowsAbout, rexo } from "@/lib/site";
import { SiteChrome } from "@/components/SiteChrome";
import "./globals.css";
import "./chrome.css";
import "./sections.css";

export const metadata: Metadata = rootMetadata();

export const viewport: Viewport = {
  themeColor: "#090d0c",
  colorScheme: "dark",
};

const personId = site.url + "/#person";
const rexoId = rexo.url.replace(/\/$/, "") + "/#organization";
const siteId = site.url + "/#website";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": siteId,
      name: site.name,
      url: site.url,
      inLanguage: site.locale,
      publisher: { "@id": personId },
    },
    {
      "@type": "ProfilePage",
      "@id": site.url + "/#profilepage",
      url: site.url,
      name: "Aria Kianzad | Brand Strategy & Personal Branding",
      description: site.description,
      inLanguage: site.locale,
      isPartOf: { "@id": siteId },
      mainEntity: { "@id": personId },
      about: { "@id": personId },
    },
    {
      "@type": "Person",
      "@id": personId,
      name: site.displayName,
      givenName: site.givenName,
      url: site.url,
      email: "mailto:" + site.email,
      jobTitle: site.title,
      description: site.description,
      image: site.url + "/og/og.png",
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

const structuredDataJson = JSON.stringify(structuredData).replace(/</g, "\\u003c");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={estedad.variable + " " + geistMono.variable}>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' https://www.googletagmanager.com https://challenges.cloudflare.com; style-src 'self'; frame-src https://challenges.cloudflare.com; img-src 'self' data: https://www.google-analytics.com https://bkohdqwecnvbmeaiuyyx.supabase.co; font-src 'self'; connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://bkohdqwecnvbmeaiuyyx.supabase.co; object-src 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests"
        />
      </head>
      <body>
        <script src="/boot.js" />
        <script src="/ui.js" defer />
        <script src="/blog-contact.js" defer />
        <script src="/blog-copy.js" defer />
        <script src="/blog-listing.js" defer />
        <script type="module" src="/_hero/hero-visual.js" />
        <SiteChrome>{children}</SiteChrome>
        <section
          id="analytics-consent"
          className="analytics-consent"
          role="region"
          aria-labelledby="analytics-consent-title"
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredDataJson }} />
      </body>
    </html>
  );
}
