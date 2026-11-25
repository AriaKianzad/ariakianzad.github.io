HOSTING BUNDLE - ariakianzad.ir
===============================

This archive is created and validated with Node.js built-ins. It does not require PowerShell, .NET, tar or unzip, so the same hosting command works on Windows, macOS and Linux.

This archive contains the complete production build of my personal website
at https://ariakianzad.ir, including the standalone Persian book page for
«میانِ ما» and an Apache configuration for shared cPanel hosting. It is
self-contained: no Node.js, build step or PHP execution is required on the server.

WHAT PHP DOES HERE: nothing. The site is completely static. PHP 8.5 can
stay selected in cPanel - it simply never runs, because there is no PHP
code in this package. Do not add PHP files or a PHP front controller; none
are needed for this site to work.

PACKAGE CONTENTS
----------------
index.html              the personal homepage (single page)
Mian-e-Ma/              standalone Persian book landing page
                        with its own HTML, CSS, cover artwork, line art,
                        Estedad font and a link to the canonical GitHub Release PDF
404.html                custom not-found page
.htaccess               Apache config: security headers, caching,
                        compression, custom error page, HTTPS +
                        canonical-host redirects
_headers                security headers in the format used by Netlify /
                        Cloudflare Pages. Apache/cPanel does NOT read this
                        file - on this hosting the .htaccess file is the
                        active configuration. _headers ships only so the
                        same site can later move to one of those hosts
                        unchanged.
_next/static/           hashed CSS and font assets (keep the folder names)
_hero/                  hero ESM entrypoint plus hashed Three.js chunk
boot.js, ui.js          site scripts (progressive enhancement)
icon.png, apple-icon.png, og/og.png     favicon icons and social image
robots.txt, sitemap.xml, llms.txt       SEO files; sitemap includes both
                        the homepage and the Persian book page
licenses/               open-source font licenses (SIL OFL 1.1:
                        OFL-Estedad.txt, OFL-GeistMono.txt)
HOSTING-README.txt      this file

BUILDING THE BUNDLE FOR THIS DOMAIN
-----------------------------------
Before creating a bundle for ariakianzad.ir, set the public canonical origin
and build a fresh export from the repository root in any terminal
(PowerShell, Command Prompt, bash or zsh):

  npm ci
  npm run build
  npm run hosting

Set NEXT_PUBLIC_SITE_URL=https://ariakianzad.ir in the environment before
running the build. For PowerShell: $env:NEXT_PUBLIC_SITE_URL =
"https://ariakianzad.ir". For bash/zsh: export
NEXT_PUBLIC_SITE_URL="https://ariakianzad.ir".

This keeps canonical URLs, Open Graph URLs and sitemap entries aligned with
the host's HTTPS redirect. For GitHub Pages, do not use this cPanel bundle;
the Actions workflow builds with https://ariakianzad.github.io by default.

DEPLOYMENT THROUGH cPANEL FILE MANAGER
--------------------------------------
1. FIND THE DOCUMENT ROOT
   In cPanel open "Domains". Find the row for ariakianzad.ir and read its
   "Document Root" column, for example /home/USERNAME/public_html or a
   dedicated folder such as /home/USERNAME/ariakianzad. Do NOT assume the
   site belongs in public_html - the correct path is whatever cPanel shows
   for this domain. (On hosts with a single account for everything,
   public_html is common; on multi-domain accounts each domain usually has
   its own folder.)

2. BACK UP WHAT IS THERE NOW
   In cPanel File Manager, open that document root. If it is not empty,
   select all current files and folders, right-click, and choose
   "Compress" to create backup-YYYY-MM-DD.zip inside the same folder (or
   move everything into a new folder named _backup). This website has no
   database, so the files are everything there is to preserve.

3. UPLOAD THE ARCHIVE
   Still inside the document root, click "Upload" in the toolbar, choose
   hosting-bundle.zip (this archive), and wait for the transfer to
   complete. Return to File Manager and refresh.

4. EXTRACT INTO THE DOCUMENT ROOT
   Right-click hosting-bundle.zip and choose "Extract". In the extraction
   dialog the destination must be the DOCUMENT ROOT ITSELF
   (for example /home/USERNAME/public_html) - not a subfolder. Confirm.
   Afterwards, index.html, .htaccess, 404.html, robots.txt, sitemap.xml,
   boot.js, ui.js, icon.png, apple-icon.png, og/, licenses/, _next/ and
   _hero/ must sit DIRECTLY inside the document root - not inside another
   folder. Once verified you
   may delete the ZIP (keep your backup).

5. CONFIRM HIDDEN FILES WERE EXTRACTED
   .htaccess starts with a dot and File Manager hides dotfiles by default.
   In File Manager click "Settings" (top right) and enable "Show Hidden
   Files (dotfiles)", then confirm .htaccess is listed in the document
   root. If it is missing, re-extract the ZIP or re-upload it - the site
   works without it, but the security headers, custom 404 page, caching,
   and HTTPS redirect do not.

6. SSL / HTTPS
   Open cPanel "SSL/TLS Status" (or run AutoSSL). If no certificate is
   issued yet for ariakianzad.ir, run AutoSSL and wait for it to complete.
   Then open https://ariakianzad.ir/ and confirm the browser shows a
   padlock and the canonical origin.
   Redirect note: .htaccess ships with the HTTPS + canonical-host redirect
   ENABLED (it sends every request to https://ariakianzad.ir). If the
   certificate is not active yet, the site will be unreachable until SSL
   works. In that case edit .htaccess in File Manager and temporarily
   comment out the five lines between the markers
   "# BEGIN HTTPS + canonical host" and "# END ...", verify the site over
   HTTP, complete SSL setup, then remove the comment markers again.

7. POST-DEPLOYMENT CHECKS (5 minutes)
   - Homepage: https://ariakianzad.ir/ shows the large hero heading.
   - Navigation: Disciplines / Approach / Rexo / About scroll to sections.
     In a phone-sized window a Menu button appears and opens a fullscreen
     list (Escape or a link tap closes it).
   - Font: headings and body use the Estedad variable font. In the
     browser's Network tab, filter by "Font" - the Estedad woff2 must load
     with status 200 (or simply compare with the design: the display
     typeface is a quiet, wide grotesque).
   - Social links: YouTube, Instagram, LinkedIn, X, Unsplash, and Medium
     icons open the correct profiles; the Rexo section links to
     https://rexo.agency/.
   - Email: the "COPY ADDRESS" button copies kianzadaria@gmail.com and
     shows a confirmation message (JavaScript enabled; the mailto link
     always works as a fallback).
   - Error page: visit /does-not-exist - the styled 404 page must appear.
   - SEO files: /robots.txt, /sitemap.xml, and /llms.txt respond with
     content (status 200).
   - Security headers: run `curl -I https://ariakianzad.ir/` (any
     terminal) or check the site on securityheaders.com. Expect:
     Content-Security-Policy, X-Content-Type-Options: nosniff,
     X-Frame-Options: DENY, Referrer-Policy:
     strict-origin-when-cross-origin, Permissions-Policy,
     Cross-Origin-Opener-Policy: same-origin. HTTP requests must land on
     the HTTPS canonical URL.

SETTINGS THAT DEPEND ON THE HOSTING PROVIDER
--------------------------------------------
- SSL certificate issuance and renewal (AutoSSL).
- Apache modules: mod_headers (security headers + caching), mod_rewrite
  (HTTPS/canonical redirects), mod_deflate + mod_filter (compression),
  mod_mime (MIME types), and mod_setenvif (hashed-asset cache rules). The
  directives are <IfModule>-guarded, so a
  missing module never breaks the site - but without mod_headers the
  security and cache headers are silently absent. Ask the provider to
  enable the module, or configure the same headers in the hosting panel.
- If TLS is terminated at a proxy/load balancer in front of Apache, use
  the X-Forwarded-Proto redirect variant documented inside .htaccess.
- HTTP/2, TLS version policy, server-level error-page overrides, and
  directory listing defaults.
- If editing .htaccess ever causes HTTP 500 errors, AllowOverride may be
  restricted on the account - contact the provider rather than removing
  the <IfModule> guards.

PACKAGE PROVENANCE
-----------------
The archive is generated locally from the current production export in out/
by `npm run hosting`. The command stages the export, includes the font
licences and this guide, validates the ZIP structure, independently lists and
extracts it, compares extracted file hashes, and runs HTTP smoke tests for the
homepage, the hero module and its hashed scene chunk, the Persian book page,
and the PDF. Always run `npm ci` and `npm run build` before generating a new
bundle. The bundle is an optional cPanel deliverable; GitHub Pages is
published separately by the GitHub Actions workflow.
