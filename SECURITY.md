# Security policy

This repository publishes a static personal website, an editorial blog, a standalone book microsite, a static analytics dashboard and a static blog CMS frontend. Supabase provides authentication, CMS storage, publication data, contact-form rate limiting and analytics APIs. Security issues can therefore involve frontend code, build scripts, GitHub Actions, Supabase Edge Functions, SQL migrations, Storage policies, the Google Apps Script mail relay or browser session handling.

## Reporting a vulnerability

Please report suspected vulnerabilities privately by email to **kianzadaria@gmail.com**. Include the affected URL or file, the impact you believe is possible, and concise reproduction steps. Do not include live passwords, access tokens, service-account JSON files or other credentials in the report.

Please do not publish an exploitable issue, proof-of-concept or sensitive data before there has been a reasonable opportunity to investigate it. I do not promise a response time, but I will review reports and make a best effort to address valid issues.

## Security design

- The dashboard URL and its noindex metadata are not access controls. Every data request is authenticated and authorized by the Supabase Edge Functions.
- The protected functions (download-stats, site-analytics and blog-admin) validate the Supabase access token with auth.getUser(token), require a confirmed user email and check that email against the active public.dashboard_admins allowlist. The public blog-contact function is intentionally unauthenticated and uses separate validation and abuse controls.
- The CMS tables public.blog_posts and public.blog_settings have RLS enabled and no direct table grants for anon or authenticated. Public publication data is exposed through explicit RPC functions that return only published snapshots and approved settings.
- The blog-media Storage bucket is public-read so published articles can render their images. Uploads run only through the authenticated blog-admin Edge Function; files are size-limited and their declared image formats are checked against file signatures.
- The public blog contact form limits request size, validates fields, rejects filled honeypots, applies a server-side rate limit and forwards mail using a server-only token to a Google Apps Script relay. Rate-limit fingerprints use HMAC-SHA-256 and the Cloudflare client-IP header; caller-supplied X-Real-IP and X-Forwarded-For fallbacks are not used.
- The browser uses only the Supabase publishable key. Supabase secret keys and the Google service-account JSON are kept in Supabase Edge Function Secrets.
- The download_snapshots and dashboard_admins tables have RLS enabled, and browser roles have no table privileges.
- The Google service account uses read-only Analytics and Search Console scopes and property-level permissions.
- Google Analytics is loaded only after a visitor accepts the consent prompt. A compact privacy-settings control remains reachable after acceptance or refusal on every public route, including blog pages. The blog suppresses the automatic first-visit prompt but still lets visitors open preferences and change their choice.
- Remembered dashboard sessions are opt-in and off by default. If enabled, only the rotating Supabase refresh token is stored in browser localStorage. It does not store the password or access token, but same-origin JavaScript can read local storage. Sign out on shared devices; logout also requests local-session revocation from Supabase.
- The build checks high-confidence credential patterns, including legacy Supabase service-role JWTs, and validates the static Content Security Policy. This is an accidental-commit guard; it is not a substitute for reviewing changes or scanning the complete Git history.
- The 3D hero uses a local, code-split Three.js ESM bundle and does not fetch JavaScript, shaders, textures or fonts from third-party CDNs. Its small entrypoint waits until the hero approaches the viewport before requesting the scene chunk. Animation pauses when the document is hidden and respects reduced-motion preferences. WebGL resources are disposed on pagehide and reinitialized after a back-forward cache restore. A CSS fallback remains visible if WebGL cannot initialize.

## Dashboard request boundary

The dashboard configuration validates the exact Supabase project origin and accepts only a publishable key before sending credentials. The Edge Functions use an explicit site-origin CORS allowlist, but CORS is not an authorization boundary. Both functions have `verify_jwt = false` because they perform their own `auth.getUser(token)` check, require a confirmed email and enforce the server-side administrator allowlist. Those checks must remain in the handlers.

The tables `public.dashboard_admins`, `public.download_snapshots`, `public.blog_posts` and `public.blog_settings` have RLS enabled and browser roles have no table privileges. There are deliberately no browser policies: a missing-policy advisor notice is expected with this permission model and must not be “fixed” by adding broad read policies.

A live Supabase Security Advisor check on 2026-11-24 also reported that `private.blog_contact_rate_limits` has RLS disabled. A direct privilege check found no SELECT or INSERT table grants for `anon` or `authenticated`; the rate-limit function is owned by `postgres`, runs as `SECURITY DEFINER`, and pins `search_path` to `pg_catalog, private`. Those controls reduce direct exposure, but the disabled RLS setting remains a defense-in-depth gap and the Advisor correctly flags it. Do not add client policies or expose this table through the Data API. A candidate hardening statement is:

```sql
ALTER TABLE private.blog_contact_rate_limits ENABLE ROW LEVEL SECURITY;
```

This statement has **not** been applied. Review the function owner and its grants before running it. The function is expected to continue accessing the table as its `postgres` owner; do not use `FORCE ROW LEVEL SECURITY` without re-testing the rate-limit function.

The private snapshot function also uses a fixed `search_path` and restricted execute privileges.

On GitHub Pages, the repository's `_headers` and `.htaccess` files are not applied as HTTP response headers. The static pages carry CSP meta policies, but meta CSP cannot replace response headers such as HSTS, X-Frame-Options, Referrer-Policy or Permissions-Policy. Do not assume those headers are active on GitHub Pages; they are configured for compatible hosts such as Apache/cPanel and supported static hosts.

## Auth password-protection status

The live Supabase Security Advisor reported `auth_leaked_password_protection` as disabled on 2026-11-24. This means Supabase Auth is not currently enforcing its hosted breached-password screening. Confirm the plan's feature availability and enable the control in Authentication → Sign In / Providers → Email when available. Until then, use a unique 12+ character administrator password, enable all four character classes in the Email provider's password-strength settings, keep public sign-ups disabled and enable MFA where practical. Do not attempt to implement Have I Been Pwned screening in browser code. This Advisor warning does not mean that an existing password has been identified in a breach.

## Supported version

The main branch is the supported version. The site is deployed through GitHub Actions. No static-hosting configuration or third-party service control can eliminate every risk.

If a credential is suspected to be exposed, revoke or rotate it at the issuing provider first, replace the corresponding Supabase secret if applicable, and review the affected repository history and deployment logs.
