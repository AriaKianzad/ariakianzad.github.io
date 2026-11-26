# Aria Kianzad

This repository contains my personal website, Persian editorial blog and CMS, the standalone microsite for the book **«میانِ ما»**, and two browser-based administration interfaces backed by Supabase.

- **Personal website:** https://ariakianzad.github.io/
- **Book page:** https://ariakianzad.github.io/Mian-e-Ma/
- **Blog:** https://ariakianzad.github.io/blog/
- **Blog CMS:** https://ariakianzad.github.io/admin/blog/
- **Analytics dashboard:** https://ariakianzad.github.io/admin/
- **Book PDF release:** https://github.com/AriaKianzad/ariakianzad.github.io/releases/tag/mian-e-ma-v1

All public pages and both admin interfaces are static frontends. The personal homepage and blog are generated with Next.js, but ship as static HTML without a Next.js hydration runtime. The 3D hero is a separate same-origin ESM module built with esbuild; it requests a locally bundled, code-split Three.js scene only when the hero approaches the viewport. Supabase provides authentication, CMS operations, publication data, site analytics and private banner-click reporting. Rexo is the creative agency at https://rexo.agency/.

## Project architecture

| Area | Implementation |
| --- | --- |
| Personal website | Next.js App Router static export; TypeScript/React at build time, standalone esbuild + Three.js ESM hero |
| Book microsite | Standalone HTML, CSS and JavaScript |
| Analytics dashboard | Static HTML, CSS and JavaScript |
| Blog CMS | Static HTML, CSS and JavaScript; privileged operations use an authenticated Supabase Edge Function |
| Blog publication | Build-time snapshot from a restricted public Supabase RPC; article and category routes are generated as static HTML |
| Hosting | GitHub Pages, with an optional Apache/cPanel bundle |
| Data and authentication | Supabase Auth, Postgres and Edge Functions |
| Download counter | GitHub Release asset metadata, captured in daily Postgres snapshots |
| Site analytics | Google Analytics 4 and Google Search Console, queried server-side |
| Consent | First-party consent panel; the Google tag loads only after consent |

The Next.js application is exported as static files. The deployed website does not run a Next.js server, has no Next.js API routes and performs no request-time server rendering. The build removes the unused Next.js hydration payload, then esbuild produces a same-origin /_hero/hero-visual.js entrypoint and a hashed Three.js scene chunk. The postbuild step generates independent 1200×630 JPEG social previews for the homepage and book page. The homepage card follows the paper/aubergine/brass identity; the book card retains the book cover and line-art while using the refreshed palette. Article preview fallbacks use the current plum-and-brass editorial colors. Open Graph, Twitter/X and the homepage Person image reference the intended generated assets. The entrypoint is loaded from the same origin and imports the scene only when the hero approaches the viewport. No 3D code, shader, texture or font is fetched from a third-party CDN. If WebGL is unavailable or the visitor prefers reduced motion, a CSS-built static visual remains. The homepage copy and structured data stay in static HTML, while public/boot.js and public/ui.js provide progressive enhancement. The dashboard is not a hidden or private deployment: its HTML and JavaScript are public. Access to its data is enforced by Supabase, not by the dashboard URL or its noindex metadata.

### Main routes

- /: English personal website.
- /Mian-e-Ma/: Persian book information and download page.
- /blog/: Persian/English editorial archive with static article and category routes.
- /blog/contact/: public contact form with server-side validation and abuse controls.
- /admin/: password-protected analytics dashboard.
- /admin/blog/: authenticated editorial CMS. Its static frontend is public code; privileged actions are checked by Supabase.
- /robots.txt, /sitemap.xml, /llms.txt: public discovery and metadata files.

The homepage is organized around research and insight, positioning and identity, content and communication, a four-step method, Rexo, writing, about and contact. Its current visual system pairs warm paper (`#F3F0E8`), aubergine (`#7B3F58`) and brass (`#D6A443`) with Estedad typography. The hero and two floating in-section scenes use locally bundled, code-split Three.js. Scroll-triggered entrances and subtle interaction respect `prefers-reduced-motion`; CSS fallbacks keep the visuals non-essential to reading and navigation.

The book download links point to the single PDF asset attached to GitHub Release mian-e-ma-v1. The duplicate PDF formerly copied into the GitHub Pages tree has been removed so there is no second public download path that bypasses the Release download counter. The Release download_count is the source of truth for total file downloads. It counts download requests reported by GitHub, not unique readers or confirmed reading sessions.

### Brand assets and social previews

- `public/favicon.svg` is the single source of truth for the browser mark. The same favicon is used by the personal site, blog, book microsite, analytics dashboard and blog CMS.
- `npm run assets` validates the locally bundled Estedad variable font, writes the vector favicon and derives the Next.js 512px icon and 180px Apple touch icon. The generated PNG copies are ignored by Git and created automatically before `dev` and production builds.
- The homepage Open Graph image is generated at `/og/og.jpg`; the book has its own 1200×630 preview at `/Mian-e-Ma/assets/mian-e-ma-social-preview.jpg`; article previews are generated per published slug at build time.
- Uploaded article OG/hero images remain content managed in Supabase Storage. The generator accepts only HTTPS media URLs from the configured public blog-media bucket, blocks redirects, and enforces an 8 MB limit. Those author-managed images are not deleted or replaced by the global brand refresh.

## Analytics and dashboard

The dashboard combines three independent data sources:

1. **GitHub Releases:** cumulative download count for Mian-e-Ma.pdf in Release mian-e-ma-v1.
2. **Google Analytics 4:** users, sessions, page views, acquisition, referrers and file_download events. A GA4 file_download event records a download interaction, not proof that someone completed or opened the PDF.
3. **Google Search Console:** search clicks, impressions, CTR, average position, queries, pages and devices.

A Supabase Cron job captures the GitHub cumulative count once per day at **00:15 UTC (03:45 Asia/Tehran)**. A private PostgreSQL function fetches the public GitHub Release API and upserts the snapshot using the Tehran calendar date. Opening the dashboard also refreshes the current day's value. Daily differences are calculated from consecutive cumulative snapshots; the first snapshot is a baseline, not historical daily data.

The personal website and book page share one consent-aware Google Analytics loader. Analytics remains off until a visitor accepts. On those routes, the floating privacy-settings control is hidden after acceptance; after a refusal it remains available so the visitor can change the choice later. The blog never displays either the consent panel or the floating preferences control, regardless of the saved choice; it still loads Analytics only when a previous consent grant exists. Consent is stored in browser local storage.

The CMS is a static frontend, but publication updates are automated: publishing or unpublishing/archiving a post, and saving relevant blog settings such as categories or SEO defaults, dispatches the GitHub Pages workflow on `main`. The workflow fetches the latest published snapshot from the restricted Supabase RPC before the build, then regenerates article and category HTML, `/sitemap.xml`, RSS at `/blog/feed.xml`, and article social images. Draft-only saves do not publish a new public build. Search engines may take time to recrawl a changed sitemap; a successful build is not a guarantee of immediate indexing.

## Authentication and data access

The analytics dashboard and blog CMS use Supabase Auth and a server-side email allowlist:

1. A user signs in through Supabase Auth.
2. The protected functions (download-stats, site-analytics and blog-admin) validate the bearer token with Auth, require a confirmed email and check the active public.dashboard_admins allowlist.
3. Only after authorization do these functions use server-side Supabase credentials to access private records, upload media or request Google reports.
4. Browser roles have no table privileges on download_snapshots, dashboard_admins, blog_posts or blog_settings. CMS publication data is exposed through an explicit public RPC that returns published snapshots and approved public settings only.
5. The public `blog-contact` function is intentionally unauthenticated. It validates requests, limits body size, uses a honeypot and a three-attempt-per-hour trusted-IP limit, and forwards mail through a token-protected Google Apps Script relay. It rejects requests if Cloudflare's managed client-IP header is missing rather than grouping all visitors into one shared bucket. Cloudflare Turnstile support is available but only becomes active after both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (GitHub Actions repository variable) and `CLOUDFLARE_TURNSTILE_SECRET_KEY` (Supabase Edge Function secret) are configured; server-side Siteverify checks the token, expected hostname and action.
6. The public `blog-ad-click` function records banner click events through a server-side RPC. It trusts only Cloudflare's managed client-IP header, stores HMAC fingerprints rather than raw IPs, and limits each banner/fingerprint pair to ten registered events per hour. Missing client IPs are not counted. The admin metric is registered click events, not unique visitors. Origin checks are defense in depth, not authentication; a non-browser client can forge an Origin header.

The dashboard's config.js contains only the Supabase project URL and a **publishable** client key. Publishable keys are designed to be visible in browser code; they are not administrator credentials. Supabase secret keys, service-role keys, GitHub tokens and Google service-account private keys must never be placed in frontend code or committed to this repository.

### Remembered sign-in

Remembered sign-in is **off by default** and requires an explicit opt-in. When **«مرا به خاطر بسپار»** is enabled, the browser stores the rotating Supabase refresh token in localStorage so the session can be restored after closing the browser. The password and access token are not stored there. However, any JavaScript executing on the same origin can read local storage. On a shared or public device, leave this option off and use the dashboard's **خروج** action when finished. Logout clears browser state and requests local-session revocation from Supabase.

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
    npm run test:security-scan
    npm run test:build-safety
    npm run test:consent
    npm run test:homepage
    npm run test:supabase
    npm run test:analytics
    npm run build
    npm run preview

The production build validates and generates the shared favicon before Next.js runs, fetches the public blog snapshot, generates article social previews, performs the static export, strips unused Next.js runtime output, compiles the route-scoped lazy hero modules and hashed Three.js chunks, then verifies the export. The preview server serves the generated out/ directory on loopback and applies the repository's static-host headers for local testing.

Additional asset and packaging tasks:

    npm run assets
    npm run social-icons
    npm run hosting

- assets validates the shipped Estedad variable font and regenerates the shared SVG favicon plus the Next.js and Apple raster icon variants.
- social-icons rebuilds the checked-in icon path map from assets-src/icons/.
- hosting creates and verifies an optional cPanel ZIP bundle. It requires Windows PowerShell and .NET's ZIP writer. The builder uses a unique temporary workspace, rejects symlinks and unsafe archive paths, and refuses to overwrite an existing hosting-bundle.zip.

## Build and deployment

GitHub Actions builds and deploys the main branch to GitHub Pages. Pull requests targeting main run the checks and build but do not deploy. The workflow:

- installs the locked dependency tree with npm ci;
- scans the working tree for high-confidence credential patterns, including legacy Supabase service-role JWTs; the regression test exercises a synthetic JWT and confirms that token values are never printed;
- runs synthetic-token and hosting-build safety regressions, plus the analytics-consent, homepage, Supabase and Google Analytics/Search Console contract tests;
- runs npm audit, TypeScript and ESLint checks;
- verifies the six social icon paths, checks the shared favicon source and runs the security, CSP, type, lint and static-export contracts;
- creates and validates the static export;
- smoke-tests the local preview, including a path-traversal request;
- deploys only from the non-PR workflow path.

Third-party GitHub Actions are pinned to immutable commit SHAs. The build job has read-only repository permissions, and only the deploy job receives Pages write and OIDC permissions.

The credential scanner checks the current working tree; it is an accidental-commit guard, not a scan of every historical Git object. A clean working-tree scan does not establish that credentials were never committed in the past. If a credential was exposed historically, revoke/rotate it and review the relevant Git history and provider audit logs.

For GitHub Pages, the canonical site URL defaults to https://ariakianzad.github.io. For the optional custom domain, set the public build-time URL before building:

    $env:NEXT_PUBLIC_SITE_URL = "https://ariakianzad.ir"
    npm run build
    npm run hosting

NEXT_PUBLIC_SITE_URL is a public URL, not a secret.

### Security headers and hosting limits

The repository keeps response-header policies in public/_headers (for compatible static hosts such as Cloudflare Pages) and public/.htaccess (for Apache/cPanel). GitHub Pages does **not** process either file, so the static HTML pages also carry a Content Security Policy meta tag. The build adds SHA-256 hashes for required inline `<style>` blocks, rejects HTML `style=` attributes, and verifies the resulting policy. Dynamic blog theme variables are emitted through those hashed style blocks; `unsafe-inline` is not enabled.

A CSP meta tag cannot set every HTTP response header. Directives such as frame-ancestors, HSTS, X-Frame-Options, Referrer-Policy and Permissions-Policy require response-header support. They are therefore available on compatible hosts through the header configuration, but should not be assumed to be active on GitHub Pages.

## Supabase backend

Supabase migrations and Edge Function sources are versioned under supabase/. The five Supabase Edge Functions defined for this project are:

- **download-stats:** authenticates an allowlisted dashboard administrator and returns the GitHub Release count and snapshot history.
- **site-analytics:** authenticates the same administrator and requests read-only GA4 and Search Console reports.
- **blog-admin:** authenticates an allowlisted administrator and handles CMS drafts, publishing, blog settings, advertising placements and media uploads.
- **blog-contact:** accepts public contact requests, applies server-side validation, optional Cloudflare Turnstile, honeypot and rate limits, then forwards them to a token-protected Google Apps Script Gmail relay.
- **blog-ad-click:** accepts public banner-click events and records rate-limited, HMAC-fingerprinted events for the authenticated admin dashboard.

To deploy function source changes using the Supabase CLI:

    supabase link --project-ref bkohdqwecnvbmeaiuyyx
    supabase functions deploy download-stats
    supabase functions deploy site-analytics
    supabase functions deploy blog-admin
    supabase functions deploy blog-contact
    supabase functions deploy blog-ad-click

The three protected functions use the exact Supabase JS version declared in their respective deno.json import maps. Their verify_jwt setting is false because the handlers explicitly call auth.getUser(token), require a confirmed email and check the active email allowlist. blog-contact and blog-ad-click are deliberate public endpoints with no dashboard login. blog-contact relies on request validation, an optional but server-validated Turnstile check, a honeypot, IP rate limiting and a server-only mail-relay token. blog-ad-click records only validated banner IDs with a per-banner/IP quota; its admin totals are not unique-user metrics. CORS is not an authorization boundary. Do not remove the protected handlers' authorization checks. Production database migrations have already been applied; review and reconcile migration history before applying any new migration.

## Repository layout

    src/
      app/                 Personal website layout, sections, responsive styles and metadata
      components/          Reusable server-rendered interface components and icons
      client/              Standalone ESM entrypoint and code-split Three.js hero scene
      content/             Website copy and brand narrative
      lib/                 Site settings, metadata and structured data

    public/
      Mian-e-Ma/           Standalone Persian book page and local assets
      admin/               Static analytics dashboard and blog CMS interfaces
      blog-contact.js      Public contact-form client
      blog-copy.js         Article share-link behavior
      blog-listing.js      Static blog archive search and filters
      analytics-consent.js Consent-aware Google Analytics loader
      _headers             Security headers for compatible static hosts
      .htaccess             Apache/cPanel security and hosting configuration
      favicon.svg          Shared vector favicon source
      og/                  Generated homepage and article social-sharing images
      boot.js, ui.js        Progressive enhancement and interface behavior

    supabase/
      functions/            Edge Function source, per-function Deno import maps and both API handlers
      migrations/           Versioned database and scheduled-job migrations
      config.toml           Function runtime configuration
      README.md             Backend setup and operational notes

    scripts/                Asset generation, credential scan, regression tests, build verification and packaging
    assets-src/             Original fonts and SVG icon sources
    LICENSES/               Font licence files
    hosting/                 Optional cPanel hosting instructions
    .github/                 GitHub Actions deployment and Dependabot configuration

## Fonts and licences

Estedad by Amin Abedi and the included Geist Mono subset are distributed under the SIL Open Font License 1.1. Their licence texts are included in LICENSES/; the standalone book page also carries the Estedad licence alongside its local font asset.
