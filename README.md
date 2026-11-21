# Aria Kianzad

This repository contains my personal website and the standalone Persian microsite for the book **«میانِ ما»**.

- **Personal website:** https://ariakianzad.github.io/
- **Book page:** https://ariakianzad.github.io/Mian-e-Ma/
- **Private analytics dashboard:** https://ariakianzad.github.io/admin/
- **Book PDF release:** https://github.com/AriaKianzad/ariakianzad.github.io/releases/tag/mian-e-ma-v1

The personal website and book page are static frontends. The personal homepage is a Next.js static export with one isolated client-side island for a locally bundled, lazy-loaded Three.js hero scene. Its main copy, navigation, expertise, method and structured data are rendered into static HTML. The analytics dashboard is also served as static files, but it talks to a separate Supabase backend for authentication and reporting. Rexo has its own website at https://rexo.agency/.

## Project architecture

| Area | Implementation |
| --- | --- |
| Personal website | Next.js App Router, React, TypeScript and Three.js for the optional 3D hero scene |
| Book microsite | Standalone HTML, CSS and JavaScript |
| Admin interface | Static HTML, CSS and JavaScript |
| Hosting | GitHub Pages, with an optional Apache/cPanel bundle |
| Data and authentication | Supabase Auth, Postgres and Edge Functions |
| Download counter | GitHub Release asset metadata, captured in daily Postgres snapshots |
| Site analytics | Google Analytics 4 and Google Search Console, queried server-side |
| Consent | First-party consent panel; the Google tag loads only after consent |

The Next.js application is exported as static files. The deployed website does not run a Next.js server, has no Next.js API routes and performs no request-time server rendering. The homepage's Three.js scene is bundled with the site, dynamically imported only when the hero approaches the viewport, and never fetched from a third-party CDN. If WebGL is unavailable or the visitor prefers reduced motion, a CSS-built static visual remains. The rest of the homepage is server-rendered HTML with progressive-enhancement scripts. The dashboard is not a hidden or private deployment: its HTML and JavaScript are public. Access to its data is enforced by Supabase, not by the dashboard URL or its noindex metadata.

### Main routes

- /: English personal website.
- /Mian-e-Ma/: Persian book information and download page.
- /admin/: password-protected analytics interface.
- /robots.txt, /sitemap.xml, /llms.txt: public discovery and metadata files.

The redesigned homepage is organized around research and insight, positioning and identity, content and communication, a four-step method, Rexo, writing, about and contact. It uses a restrained dark editorial system, Estedad typography, a locally bundled 3D signal sculpture in the hero, scroll-triggered section entrances and subtle interactive diagrams. Motion respects `prefers-reduced-motion`; the hero has a CSS fallback and is not required to read or navigate the page.

The book download links point to the PDF asset attached to GitHub Release mian-e-ma-v1. The Release download_count is the source of truth for total file downloads. It counts download requests reported by GitHub, not unique readers or confirmed reading sessions.

## Analytics and dashboard

The dashboard combines three independent data sources:

1. **GitHub Releases:** cumulative download count for Mian-e-Ma.pdf in Release mian-e-ma-v1.
2. **Google Analytics 4:** users, sessions, page views, acquisition, referrers and file_download events. A GA4 file_download event records a download interaction, not proof that someone completed or opened the PDF.
3. **Google Search Console:** search clicks, impressions, CTR, average position, queries, pages and devices.

A Supabase Cron job captures the GitHub cumulative count once per day at **00:15 UTC (03:45 Asia/Tehran)**. A private PostgreSQL function fetches the public GitHub Release API and upserts the snapshot using the Tehran calendar date. Opening the dashboard also refreshes the current day's value. Daily differences are calculated from consecutive cumulative snapshots; the first snapshot is a baseline, not historical daily data.

The personal and book pages ask visitors for analytics consent. The Google Analytics tag is not requested until a visitor accepts. A refusal keeps analytics disabled; visitors can reopen the privacy settings later. The consent choice is stored in browser local storage.

## Dashboard security model

The dashboard uses Supabase Auth and a server-side email allowlist:

1. A user signs in through Supabase Auth.
2. Each Edge Function validates the access token with Supabase Auth.
3. The user must have a confirmed email and an active matching entry in public.dashboard_admins.
4. The Edge Functions use server-side Supabase credentials to access the database and Google APIs.
5. Browser roles have no table privileges on download_snapshots or dashboard_admins; both tables have Row Level Security enabled.

The dashboard's config.js contains only the Supabase project URL and a **publishable** client key. Publishable keys are designed to be visible in browser code; they are not administrator credentials. Supabase secret keys, service-role keys, GitHub tokens and Google service-account private keys must never be placed in frontend code or committed to this repository.

### Remembered sign-in

When **«مرا به خاطر بسپار»** is enabled, the browser stores the rotating Supabase refresh token in localStorage so the session can be restored after closing the browser. The password and access token are not stored there. However, any JavaScript executing on the same origin can read local storage. On a shared or public device, turn this option off and use the dashboard's explicit **خروج** action when finished.

### Google credentials

The Google service-account JSON is stored as the Supabase Edge Function secret GOOGLE_SERVICE_ACCOUNT_JSON. The service account receives read-only access to the specific GA4 property and restricted access to the Search Console property. Its private key is not part of this repository. The browser never calls Google APIs with that private key.

See **supabase/README.md** for backend setup and deployment notes, and **SECURITY.md** for the security-reporting process.

## Technology and requirements

- **Node.js 22** (see .nvmrc and the engines field).
- npm with the committed package-lock.json.
- Next.js, React and TypeScript for the personal website.
- Estedad for Persian typography; Geist Mono for small technical annotations.
- No runtime framework is required to serve the exported static files.

Dependency versions are locked in package.json and package-lock.json. Dependabot checks npm dependencies and GitHub Actions weekly.

## Run locally

From the repository root:

    npm ci
    npm run dev

Useful checks and production commands:

    npm run typecheck
    npm run lint
    npm run audit
    npm run check:security
    npm run test:consent
    npm run test:homepage
    npm run build
    npm run preview

The production build runs the static-export cleanup and invariant checks automatically. The preview server serves the generated out/ directory on loopback and applies the repository's static-host headers for local testing.

Additional asset and packaging tasks:

    npm run assets
    npm run social-icons
    npm run hosting

- assets regenerates the social card and app icons from local source assets.
- social-icons rebuilds the checked-in icon path map from assets-src/icons/.
- hosting creates and verifies an optional cPanel ZIP bundle. It requires Windows PowerShell and .NET's ZIP writer.

## Build and deployment

GitHub Actions builds and deploys the main branch to GitHub Pages. Pull requests targeting main run the checks and build but do not deploy. The workflow:

- installs the locked dependency tree with npm ci;
- scans the repository for common credential patterns;
- runs npm audit, TypeScript and ESLint checks;
- verifies generated social icon paths and build scripts;
- creates and validates the static export;
- smoke-tests the local preview, including a path-traversal request;
- deploys only from the non-PR workflow path.

Third-party GitHub Actions are pinned to immutable commit SHAs. The build job has read-only repository permissions, and only the deploy job receives Pages write and OIDC permissions.

For GitHub Pages, the canonical site URL defaults to https://ariakianzad.github.io. For the optional custom domain, set the public build-time URL before building:

    $env:NEXT_PUBLIC_SITE_URL = "https://ariakianzad.ir"
    npm run build
    npm run hosting

NEXT_PUBLIC_SITE_URL is a public URL, not a secret.

### Security headers and hosting limits

The repository keeps response-header policies in public/_headers (for compatible static hosts such as Cloudflare Pages) and public/.htaccess (for Apache/cPanel). GitHub Pages does **not** process either file, so the static HTML pages also carry a Content Security Policy meta tag. The build adds hashes for any required inline style blocks and verifies the policy.

A CSP meta tag cannot set every HTTP response header. Directives such as frame-ancestors, HSTS, X-Frame-Options, Referrer-Policy and Permissions-Policy require response-header support. They are therefore available on compatible hosts through the header configuration, but should not be assumed to be active on GitHub Pages.

## Supabase backend

Supabase migrations and Edge Function sources are versioned under supabase/. The two deployed functions are:

- **download-stats:** authenticates an allowlisted dashboard administrator and returns the GitHub Release count and snapshot history.
- **site-analytics:** authenticates the same administrator and requests read-only GA4 and Search Console reports.

To deploy function source changes using the Supabase CLI:

    supabase link --project-ref bkohdqwecnvbmeaiuyyx
    supabase functions deploy download-stats
    supabase functions deploy site-analytics

Both functions set verify_jwt = false in supabase/config.toml because the handler performs its own explicit user-token verification and admin-allowlist check. Do not remove those checks. Production database migrations have already been applied; review migration state before applying any new migration.

## Repository layout

    src/
      app/                 Personal website layout, sections, responsive styles and metadata
      components/          Reusable interface components, icons and the lazy 3D hero scene
      content/             Website copy and brand narrative
      lib/                 Site settings, metadata and structured data

    public/
      Mian-e-Ma/           Standalone Persian book page and local assets
      admin/               Static dashboard interface and public client config
      analytics-consent.js Consent-aware Google Analytics loader
      _headers             Security headers for compatible static hosts
      .htaccess             Apache/cPanel security and hosting configuration
      og/                  Generated social-sharing image
      boot.js, ui.js        Progressive enhancement and interface behavior

    supabase/
      functions/            Edge Function source, including both deployed functions
      migrations/           Versioned database and scheduled-job migrations
      config.toml           Function runtime configuration
      README.md             Backend setup and operational notes

    scripts/                Asset generation, security checks, homepage regression tests, build and packaging
    assets-src/             Original fonts and SVG icon sources
    LICENSES/               Font licence files
    hosting/                 Optional cPanel hosting instructions
    .github/                 GitHub Actions deployment and Dependabot configuration

## Fonts and licences

Estedad by Amin Abedi and the included Geist Mono subset are distributed under the SIL Open Font License 1.1. Their licence texts are included in LICENSES/; the standalone book page also carries the Estedad licence alongside its local font asset.
