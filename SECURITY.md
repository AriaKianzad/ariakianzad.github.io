# Security policy

This repository publishes a static personal website, a standalone book microsite and a static admin dashboard frontend. The dashboard uses a separate Supabase backend for authentication and analytics. Security issues can therefore involve frontend code, build scripts, GitHub Actions, Supabase Edge Functions, SQL migrations or browser session handling.

## Reporting a vulnerability

Please report suspected vulnerabilities privately by email to **kianzadaria@gmail.com**. Include the affected URL or file, the impact you believe is possible, and concise reproduction steps. Do not include live passwords, access tokens, service-account JSON files or other credentials in the report.

Please do not publish an exploitable issue, proof-of-concept or sensitive data before there has been a reasonable opportunity to investigate it. I do not promise a response time, but I will review reports and make a best effort to address valid issues.

## Security design

- The dashboard URL and its noindex metadata are not access controls. Every data request is authenticated and authorized by the Supabase Edge Functions.
- The functions validate the Supabase access token, require a confirmed user email and check that email against the active public.dashboard_admins allowlist.
- The browser uses only the Supabase publishable key. Supabase secret keys and the Google service-account JSON are kept in Supabase Edge Function Secrets.
- The download_snapshots and dashboard_admins tables have RLS enabled, and browser roles have no table privileges.
- The Google service account uses read-only Analytics and Search Console scopes and property-level permissions.
- Google Analytics is loaded only after a visitor accepts the consent prompt. The settings control remains visible after acceptance or refusal, so a visitor can withdraw consent later.
- Remembered dashboard sessions are opt-in and off by default. If enabled, only the rotating Supabase refresh token is stored in browser localStorage. It does not store the password or access token, but same-origin JavaScript can read local storage. Sign out on shared devices; logout also requests local-session revocation from Supabase.
- The build checks high-confidence credential patterns, including legacy Supabase service-role JWTs, and validates the static Content Security Policy. This is an accidental-commit guard; it is not a substitute for reviewing changes or scanning the complete Git history.
- The 3D hero uses a local, code-split Three.js ESM bundle and does not fetch JavaScript, shaders, textures or fonts from third-party CDNs. Its small entrypoint waits until the hero approaches the viewport before requesting the scene chunk. Animation pauses when the document is hidden and respects reduced-motion preferences. WebGL resources are disposed on pagehide and reinitialized after a back-forward cache restore. A CSS fallback remains visible if WebGL cannot initialize.

## Dashboard request boundary

The dashboard configuration validates the exact Supabase project origin and accepts only a publishable key before sending credentials. The Edge Functions use an explicit site-origin CORS allowlist, but CORS is not an authorization boundary. Both functions have `verify_jwt = false` because they perform their own `auth.getUser(token)` check, require a confirmed email and enforce the server-side administrator allowlist. Those checks must remain in the handlers.

The tables `public.dashboard_admins` and `public.download_snapshots` have RLS enabled and browser roles have no table privileges. There are deliberately no browser policies: a missing-policy advisor notice is expected with this permission model and must not be “fixed” by adding broad read policies. A private `SECURITY DEFINER` snapshot function uses a fixed `search_path` and is executable only by the database `postgres` role.

On GitHub Pages, the repository's `_headers` and `.htaccess` files are not applied as HTTP response headers. The static pages carry CSP meta policies, but meta CSP cannot replace response headers such as HSTS, X-Frame-Options, Referrer-Policy or Permissions-Policy. Do not assume those headers are active on GitHub Pages; they are configured for compatible hosts such as Apache/cPanel and supported static hosts.

## Auth password-protection limitation

The current Supabase organization uses the Free plan. Supabase's breached-password screening is a Pro-and-above feature, so the `auth_leaked_password_protection` advisor warning remains until the plan changes. This warning does not mean an existing password has been found in a breach. Use a unique 12+ character administrator password, enable all four character classes in the Email provider's password-strength settings, keep public sign-ups disabled, and enable MFA where practical. Do not attempt to implement Have I Been Pwned screening in browser code.

## Supported version

The main branch is the supported version. The site is deployed through GitHub Actions. No static-hosting configuration or third-party service control can eliminate every risk.

If a credential is suspected to be exposed, revoke or rotate it at the issuing provider first, replace the corresponding Supabase secret if applicable, and review the affected repository history and deployment logs.
