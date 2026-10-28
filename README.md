# aria-kianzad.ir

The personal website of **Aria Kianzad**, brand strategist & copywriter
(<https://ariakianzad.ir/>). A single static page: dark, quiet, editorial, and
completely separate from the Rexo agency site (Rexo is only linked at
<https://rexo.agency/>).

## Stack

- Next.js 16.4.3 (App Router), React 19.3.1, TypeScript 5.9.3, ESLint 10
- `output: "export"`: the build is a fully static site in `out/`
- **Zero client runtime.** No `"use client"` components, no hydration. The only
  scripts shipped are two small same-origin files: `public/boot.js` (sets
  `html[data-js]` before first paint) and `public/ui.js` (menu overlay, scroll
  spy, scroll reveals, copy-email). A postbuild script strips everything else
  Next.js emits (inline bootstrap, runtime chunks, script preloads) so a
  strict CSP holds.

## Commands

```bash
npm install
npm run build        # next build + postbuild strip + export verification → out/
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run hosting      # build hosting-bundle.zip from the final out/ (cPanel-ready)
npm run assets       # regenerate og.png / icon.png / apple-icon.png (also re-verifies the font)
npm run dev          # dev server
node scripts/serve.mjs 4173   # preview out/ locally with the real security headers applied
                     # test-only flags: --allow-framing, --csp-noscript,
                     # --root=<dir>, --headers-file=<path>
```

## Fonts

### Estedad (primary typeface, the whole site)

- **Source of truth:** the official v8.5 release by Amin Abedi,
  <https://github.com/aminabedi68/Estedad> (releases/tag/8.5). The release zip
  was downloaded and its SHA-256 verified against the official asset
  (`e780f2c9…44728e`).
- **File:** `Estedad[wght].woff2` from that release, copied to
  `src/app/fonts/estedad-variable.woff2` (120,924 bytes, one variable file
  covering weights 100–900).
- **Verified before adoption** (scripts/generate-assets.mjs does this on every
  run): the actual shipping WOFF2 is decompressed (wawoff2) and parsed
  (opentype.js) — the `fvar` table confirms a genuine variable font with
  `wght: 100–900`, and Latin coverage is confirmed (upper/lower case, digits,
  `& @ ? . ! ' ’ – …`).
- **License:** SIL Open Font License 1.1, from the repository's `OFL.txt`,
  kept at `LICENSES/OFL-Estedad.txt`.
- **Wiring:** `next/font/local` in `src/app/fonts.ts` with
  `weight: "100 900"`, `display: "swap"`, CSS variable `--font-estedad`, and a
  size-adjusted fallback face (CLS-safe swap). Verified in the rendered page:
  computed `font-family` on `body`/`h1` is `estedad, "estedad Fallback", …`
  and `document.fonts` reports `estedad 100 900` loaded.

### Geist Mono (indices, eyebrows, annotations only)

- Latin subset WOFF2 served by Google Fonts (v6), 23,128 bytes, at
  `src/app/fonts/geist-mono-latin.woff2`; same `next/font/local` wiring with
  `--font-geist-mono`.
- License: SIL Open Font License 1.1 (Vercel), at `LICENSES/OFL-GeistMono.txt`.

Static outline instances of Estedad (Regular, SemiBold) live in `assets-src/`
and are used only by `scripts/generate-assets.mjs` to draw the social card and
icons as vector paths (no system fonts involved in rendering).

## Architecture notes

- **Content** lives in `src/content/home.ts`, configuration in
  `src/lib/site.ts`, document metadata in `src/lib/metadata.ts`. All copy is
  first person, contains no em dashes, and asserts nothing that isn't
  supplied fact (no clients, metrics, awards, testimonials).
- **Icons** are inline SVG geometry from Simple Icons (CC0), vendored in
  `assets-src/icons/` and extracted to `src/lib/social-icons.json`
  (`scripts/extract-social-paths.mjs`). The LinkedIn glyph comes from
  simple-icons@9 (it was removed from the set at v10); the rest from v15.
- **Progressive enhancement.** Without JavaScript the page is complete and
  styled: no `data-reveal` element is ever hidden without `html[data-js]`,
  the menu falls back to a plain link row, and the email address is a normal
  `mailto:` link.
- **The postbuild strip** (`scripts/strip-next-runtime.mjs`) removes only
  output that belongs to Next.js' runtime, matched by signature: the React
  Flight inline scripts (`self.__next_f…`, including the array initializer and
  the Turbopack bootstrap), `/_next/` chunk scripts, and script/fetch preloads
  (font preloads, `as="font"`, are kept). JSON-LD is data, not code, and is
  always kept; any unknown inline script is left in place with a loud build
  warning instead of being silently deleted. It then removes exactly the
  now-unreferenced runtime artifacts (chunk JS, build manifests, RSC payload
  text files matching `index.txt` / `_not-found.txt` / `__next.*`, the
  `_not-found` directory) — real content such as `robots.txt` and `llms.txt`
  never matches. `scripts/verify-export.mjs` runs after it and fails the build
  if any page-referenced asset is missing from `out/`, a runtime or unexpected
  inline script remains, the `_headers` and `.htaccess` CSPs disagree or
  contain `unsafe-inline`, or a required deployment file is absent.
  Latest run: `index.html` 54,124 → 20,416 bytes; 10 inline scripts, 18
  runtime chunks, 3 script preloads removed; 14 dead artifacts cleaned.

## Security

`public/_headers` (Netlify/Cloudflare Pages format) and `public/.htaccess`
(Apache/cPanel) declare the same policy; `scripts/verify-export.mjs` fails the
build if the two CSPs disagree or either contains `unsafe-inline`/`unsafe-eval`
(`scripts/serve.mjs` applies the same headers locally):

- `Content-Security-Policy`: `default-src 'self'; script-src 'self'; no
  'unsafe-inline'`. Styles are same-origin files (there are no inline
  `<style>` blocks in the export; if any ever appear, the postbuild script
  appends their sha256 hashes to `style-src` automatically).
  `img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self';
  form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests`.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  (camera/microphone/geolocation/topics disabled), HSTS with preload,
  `Cross-Origin-Opener-Policy: same-origin`.
- No tracking, analytics, cookies, forms, or backend of any kind.

HSTS is active in `_headers` (for platform-managed HTTPS hosts) but ships
commented-out in `.htaccess`: on cPanel it must be enabled by a human only
after HTTPS is confirmed working on the domain and subdomains, because it
instructs browsers to refuse plain HTTP for a full year (see
`hosting/HOSTING-README.txt`).

Verified in the browser under exactly this CSP: the console is completely
clean (zero violations), fonts load, and all interactions work. The same
tests were re-run on the extracted `hosting-bundle.zip` copy.

## Accessibility (WCAG 2.2 AA target)

- One accent used only for signal; body text ≥ 7:1 contrast on the background.
- Visible focus (`:focus-visible`, 2px accent outline) on every control;
  skip link to `#main`.
- Touch targets ≥ 44×44 (nav links, buttons, social icons, menu trigger).
- `prefers-reduced-motion: reduce` disables the intro/reveal animations,
  underline draws, and smooth scrolling; `ui.js` also re-shows all
  reveal-gated content immediately when the preference is set.
- Works without JavaScript (see above).
- Lighthouse (mobile emulation): Accessibility 100, Best Practices 100,
  SEO 100.

## SEO

- Exact title `Aria Kianzad | Brand Strategist & Copywriter`, canonical
  `https://ariakianzad.ir/`, full Open Graph + Twitter card metadata with a
  local 1200×630 `og.png`.
- `robots.txt` + `sitemap.xml` (generated by `src/app/robots.ts` and
  `src/app/sitemap.ts`, both `force-static` for the export).
- JSON-LD: `ProfilePage` / `Person` with `sameAs` (the six social profiles),
  `knowsAbout`, and `founder` → Rexo.
- `public/llms.txt` for LLM crawlers.
- `404.html` + `_not-found.html` for classic hosts.

## Responsive behavior

Fluid type and spacing throughout (clamp-based scale), a 12-column grid, and
no fixed-width elements. Layouts collapse to a single column at ≤ 899px and
further simplify at ≤ 699px. The email link uses `overflow-wrap: anywhere`.

## Project structure

```
src/
  app/
    layout.tsx        chrome (header/footer), fonts, JSON-LD, boot/ui scripts
    page.tsx          the single page (hero → contact)
    not-found.tsx
    fonts.ts          next/font/local wiring for Estedad + Geist Mono
    fonts/            estedad-variable.woff2, geist-mono-latin.woff2
    globals.css       tokens, base, utilities, reveal system
    chrome.css        header, nav, footer
    sections.css      hero, perspective, disciplines, approach, Rexo, about, contact
    icon.png          512×512 favicon (generated)
    apple-icon.png    180×180 (generated)
    robots.ts, sitemap.ts
  components/icons.tsx
  content/home.ts     all copy
  lib/site.ts         facts: name, email, socials, nav, Rexo
  lib/metadata.ts     title/description/OG/Twitter
  lib/social-icons.json
assets-src/           official font sources + vendored icon SVGs
public/               boot.js, ui.js, _headers, .htaccess, llms.txt, og/og.png
hosting/              HOSTING-README.txt (shipped inside hosting-bundle.zip)
scripts/              generate-assets, strip-next-runtime, verify-export,
                      extract-social-paths, serve, make-hosting-bundle
LICENSES/             OFL-Estedad.txt, OFL-GeistMono.txt
```

At the repository root, `hosting-bundle.zip` (built by `npm run hosting`) is
the ready-to-upload cPanel deliverable.

## Deployment

1. `npm run build`
2. Then, depending on the host:
   - **cPanel / Apache (ariakianzad.ir):** `npm run hosting`, then upload
     `hosting-bundle.zip` through cPanel File Manager and extract it directly
     into the domain's document root. `hosting/HOSTING-README.txt` (also inside
     the archive) has the step-by-step guide. `.htaccess` supplies the security
     headers, caching, compression, custom 404 page, and HTTPS/canonical-host
     redirects — no rebuild or server-side dependencies on the recipient side.
   - **Netlify / Cloudflare Pages:** deploy `out/` directly; the `_headers`
     file is honored there.

Nothing in this repository modifies or depends on the Rexo agency project;
the only connection between the two sites is the link to
<https://rexo.agency/>.
