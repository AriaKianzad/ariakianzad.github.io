# Security policy

This repository publishes a static personal website, a Persian blog and its browser-based CMS, a standalone book microsite, and two browser-based dashboards. Public HTML, CSS and JavaScript are visible to everyone. Security issues can involve frontend code, build scripts, GitHub Actions, Supabase Edge Functions, SQL migrations, Storage policies or browser session handling.

## Reporting a vulnerability

Please report suspected vulnerabilities privately by email to **kianzadaria@gmail.com**. Include the affected URL or file, the impact you believe is possible, and concise reproduction steps. Do not include live passwords, access tokens, service-account JSON files or other credentials in the report.

Please do not publish an exploitable issue, proof-of-concept or sensitive data before there has been a reasonable opportunity to investigate it. I do not promise a response time, but I will review reports and make a best effort to address valid reports.

## Security design

- The paths `/admin/` and `/admin/blog/` are public static files. Their `noindex` metadata is not an access control. All privileged data operations are authorized by Supabase Edge Functions.
- `download-stats`, `site-analytics` and `blog-admin` are admin-only functions. Each validates the bearer access token with Supabase Auth `auth.getUser(token)`, requires a confirmed email and checks the active, lowercase email in `public.dashboard_admins`. They intentionally set `verify_jwt = false` because the same checks are enforced explicitly in the function handler. Do not remove those checks.
- `blog-contact` is intentionally public so a visitor can submit the contact form. It is not protected by the administrator allowlist. It validates the exact site Origin, request method/content type, body size, fields and request type; includes a honeypot; enforces a three-request-per-hour limit using a keyed hash rather than storing raw visitor IPs; and forwards mail through a Google Apps Script protected by a server-side shared secret. CORS and Origin checks are not authentication and do not prevent direct non-browser requests. Keep the validation, rate limiter and relay token.
- The browser uses only the Supabase publishable key. Supabase secret keys, legacy service-role keys, the GitHub workflow token, Google service-account JSON and the Apps Script relay token are kept in Supabase Edge Function Secrets. Never place them in browser assets, static HTML or Git history.
- `public.blog_posts` and `public.blog_settings` have RLS enabled and browser-role table privileges revoked. Public content is served through a restricted published-content RPC; draft rows are not part of that payload. CMS writes and media uploads use the admin-only function and server-side credentials.
- The `blog-media` Storage bucket is public for reads so published article images and banners can be displayed. Browser uploads are not enabled by Storage policy; uploads are performed by `blog-admin` after authorization and server-side MIME, signature and size checks. GIF uploads are preserved as original files.
- The `download_snapshots` and `dashboard_admins` tables have RLS enabled and no browser-role privileges or browser policies. The Security Advisor's `rls_enabled_no_policy` INFO finding is expected with this design; do not add broad policies merely to silence it. The private contact rate-limit table is not directly accessible to browser roles.
- Private SQL functions use fixed `search_path` settings and restricted execution where they mutate private data. The public blog payload helper is a `SECURITY DEFINER` function outside the exposed API schemas and is reachable through a constrained public wrapper that returns published content only.
- The Google service account uses read-only Analytics and Search Console scopes and property-level permissions. Its private key is never sent to the browser.
- Google Analytics is requested only after consent has been recorded. The personal and book surfaces show the consent controls. Blog pages intentionally avoid an overlay and load GA only when a prior consent choice is already stored; absence of a grant means no Google tag is requested there.
- Remembered dashboard sessions are opt-in and off by default. If enabled, only the rotating Supabase refresh token is stored in browser localStorage. Same-origin JavaScript can read local storage, so leave the option off on shared devices and use logout when finished.
- The build checks high-confidence credential patterns, including legacy Supabase service-role JWTs, runs dependency auditing and validates the static Content Security Policy. These are preventive checks, not a scan of the entire Git history or a formal penetration test.
- The 3D hero uses a local, code-split Three.js ESM bundle. It does not fetch scripts, shaders, textures or fonts from a third-party CDN; it respects reduced-motion preferences and releases WebGL resources on page lifecycle transitions.

## Browser security policy and hosting limits

The build uses a restrictive Content Security Policy. Inline scripts and dynamic inline style attributes are not allowed. Required server-generated style blocks are hashed into the page CSP and compatible-host header policies; the export verifier rejects any `style=""` attribute. A meta CSP is included because GitHub Pages does not apply the repository's `_headers` or `.htaccess` files.

A meta CSP cannot set every HTTP response header. Directives such as `frame-ancestors`, HSTS, X-Frame-Options, Referrer-Policy and Permissions-Policy require response-header support. They are configured for compatible hosts such as Apache/cPanel and supported static hosts, but must not be assumed active on GitHub Pages.

## Current Supabase security-advisor findings

The latest project Security Advisor reported:

- `rls_enabled_no_policy` at INFO for `public.dashboard_admins` and `public.download_snapshots`. These tables are intentionally inaccessible to browser roles; do not add client-facing policies to clear this informational notice.
- `auth_leaked_password_protection` at WARN because breached-password screening is disabled. This is a configuration warning, not evidence that an existing password has been found in a breach. Enable Supabase's built-in protection if it is available for the project's plan; otherwise use a unique 12+ character administrator password, strong password-strength rules, public sign-ups disabled and MFA where practical.

At the time of this audit, Supabase reported no performance or health advisor findings. Re-run the Security Advisor after Auth, database, Storage or Edge Function configuration changes.

## Supported version

The main branch is the supported version. The site is deployed through GitHub Actions. GitHub Pages is a static host and does not provide the same response-header controls as a configurable Apache or Cloudflare host.

If a credential is suspected to be exposed, revoke or rotate it at the issuing provider first, replace the corresponding Supabase secret if applicable, and review the affected repository history and deployment logs.
