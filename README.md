# Aria Kianzad

I use this repository to build and publish my personal website. It brings together the way I think about brand strategy, the work I do through Rexo, and a little about my background.

**Live website:** <https://ariakianzad.github.io/>

I also publish the Persian book page for **«میانِ ما»** here:

- [Read about the book](https://ariakianzad.github.io/Mian-e-Ma/)
- [Download the PDF](https://ariakianzad.github.io/Mian-e-Ma/assets/Mian-e-Ma.pdf)

The personal website and the book page are separate static experiences. Rexo has its own website at <https://rexo.agency/>.

## What I use

- **Next.js 16.4.6**, React 19.3.1 and TypeScript.
- **Estedad** as the main typeface, with a local Geist Mono subset for small annotations.
- A static export. The deployed site does not need a Node.js server, database, API routes or runtime rendering.
- A small amount of vanilla JavaScript for the mobile menu, scroll navigation, reveal effects and copy-email interaction.

I keep the site deliberately light: no analytics, tracking scripts, cookies, forms or third-party runtime assets. For security reports, I keep the process in [SECURITY.md](SECURITY.md).

## Run it locally

I use the Node.js version recorded in `.nvmrc` (currently 22) and npm. The `engines` field in `package.json` keeps the supported major version explicit. From the repository root:

```bash
npm ci
npm run dev
```

The checks and production build are:

```bash
npm run typecheck
npm run lint
npm run audit
npm run build
npm run preview
```

The build runs the postbuild cleanup and export verification automatically. The preview server serves the generated `out/` folder and applies the headers from `out/_headers`.

A few extra tasks I use when working on assets:

```bash
npm run assets        # regenerate the social card and app icons
npm run social-icons  # rebuild the SVG path map from assets-src/icons/
npm run hosting       # create and verify the optional cPanel hosting bundle
```

The hosting-bundle command uses Windows PowerShell and .NET's ZIP writer. I generate that archive only when I need it; it is intentionally not committed to the repository. The root `.editorconfig` and `.gitattributes` keep text encoding, line endings and indentation consistent across editors and operating systems.

## How I keep things organised

```text
src/
  app/          page layout, styles, metadata, robots and sitemap
  components/   reusable interface components and icons
  content/      the website's written content
  lib/          site settings, metadata and structured data inputs

public/
  Mian-e-Ma/    the standalone Persian book page and its assets
  og/           the generated social-sharing image
  boot.js       small script that enables progressive enhancement
  ui.js         menu, scroll, reveal and copy-email interactions
  _headers      security headers for compatible static hosts
  .htaccess     optional Apache/cPanel configuration
  llms.txt      concise site information for AI crawlers

assets-src/     source fonts and the original SVG icon files
scripts/        asset generation, export checks, preview and packaging tools
hosting/        instructions for the optional cPanel bundle
LICENSES/       font licence files
.github/        deployment workflow and dependency update settings
```

At the root, `.nvmrc` sets my Node.js version, `.editorconfig` and
`.gitattributes` keep files consistent across editors and operating systems,
and `SECURITY.md` explains how to report a security issue.

The source for the personal homepage lives in `src/`. The book page is intentionally kept as a self-contained static page under `public/Mian-e-Ma/`; Next.js copies it into the exported site without turning it into part of the React app.

## Publishing

I publish the website to GitHub Pages from the `main` branch. The workflow in `.github/workflows/deploy.yml` installs the lockfile, checks dependencies, runs TypeScript and ESLint, builds the static export, verifies the pages and assets, and deploys the result.

The workflow is pinned to immutable action commits. Dependabot checks npm packages and GitHub Actions for updates.

GitHub Pages does not read Apache `.htaccess` or Netlify-style `_headers` files. I keep those files in the source for an optional compatible host; the Pages workflow excludes them from the GitHub Pages artifact. If I build the cPanel bundle for `ariakianzad.ir`, I set the public origin before building:

```powershell
$env:NEXT_PUBLIC_SITE_URL = "https://ariakianzad.ir"
npm run build
npm run hosting
```

For GitHub Pages, the workflow defaults to `https://ariakianzad.github.io`. `NEXT_PUBLIC_SITE_URL` is a public build-time URL, not a secret.

## Fonts and licences

I use the Estedad variable font by Amin Abedi under the SIL Open Font License 1.1. The Geist Mono subset is also distributed under the SIL Open Font License. The corresponding licence texts are kept in `LICENSES/`, and the book page carries the Estedad licence alongside its local font file.

I keep the original font and icon inputs in `assets-src/` so generated assets can be reproduced instead of relying on files that exist only on one computer.
