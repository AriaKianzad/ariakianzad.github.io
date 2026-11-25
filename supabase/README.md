# Website, blog CMS and analytics backend

The public site is hosted at https://ariakianzad.github.io/. The analytics dashboard is at /admin/ and the editorial CMS is at /admin/blog/. All frontends, HTML, CSS, JavaScript and publishable client configuration are public static files. Supabase enforces authentication, CMS operations, publication access, contact-form abuse controls, private banner-click tracking and analytics data access.

## Project

- Supabase project: mian-e-ma-analytics
- Project ref: bkohdqwecnvbmeaiuyyx
- Region: eu-central-1
- Edge Functions: download-stats, site-analytics, blog-admin, blog-contact, blog-ad-click
- Database schemas: public and private; the private schema contains snapshot, published-payload and contact-rate-limit helpers
- Storage bucket: blog-media (public read, authenticated CMS upload)

All five Edge Function sources are tracked in this repository:

- supabase/functions/download-stats/index.ts
- supabase/functions/site-analytics/index.ts
- supabase/functions/blog-admin/index.ts
- supabase/functions/blog-contact/index.ts
- supabase/functions/blog-ad-click/index.ts
- integrations/google-apps-script/blog-contact.gs (Gmail relay)

The repository source is the version-controlled reference for deployments. Edge Function deployments are independent from the GitHub Pages site deployment: publishing the website does not update Supabase functions. After a function deployment, verify its active version and deployed source against the corresponding file and deno.json in this repository; do not assume the GitHub Pages workflow updates Supabase.

## Security and authorization model

1. The browser signs in through Supabase Auth using the publishable key in public/admin/config.js.
2. The browser sends its access token to the protected functions: download-stats, site-analytics and blog-admin.
3. Each protected function verifies the token with Auth using auth.getUser(token), requires a confirmed email and checks the active lowercase email against public.dashboard_admins.
4. Only after authorization do the protected functions use server-side Supabase credentials to read/write private records, upload media or request Google reports.
5. The public blog frontend never queries blog_posts or blog_settings directly. Its build calls get_public_blog_payload, which returns published snapshots and approved settings only.
6. anon and authenticated have no direct table privileges on dashboard_admins, download_snapshots, blog_posts or blog_settings. The blog-media Storage bucket is public-read for rendering published images, but uploads are handled by the authenticated blog-admin function.
7. blog-contact is intentionally public: it checks the expected Origin, accepts POST JSON only, caps the request body at 12 KB, validates the fields, ignores a filled honeypot and permits at most three submissions per client-IP fingerprint per hour. It does not store raw IP addresses. Email is forwarded using a server-only token to a Google Apps Script relay.

Each function's deno.json pins the direct @supabase/supabase-js dependency to an exact version and maps the package to its source import. The current pin is 2.119.2. There is not yet a committed deno.lock, so transitive Deno dependency resolution is not completely frozen; generate and commit per-function lockfiles before treating builds as fully reproducible.

The three protected functions have verify_jwt = false in supabase/config.toml because they implement their own explicit access-token validation and allowlist check. Each protected handler calls auth.getUser(token), requires a confirmed email and checks the active allowlist. This is intentional. blog-contact is the public exception and does not require a user login; it uses its own input validation, origin check, rate limiter and server-only relay token. Do not remove the protected handlers' checks or change verify_jwt without reviewing the complete authentication flow.

The client configuration contains only the Supabase project URL and an sb_publishable_ key. Publishable keys are intended for browser use. Never put a Supabase secret key, legacy service-role key, GitHub token or Google private key in public/admin/config.js, any other browser asset or Git history.

## Leaked-password protection and Free-plan fallback

The live organization was verified as **Free** on 2026-11-24, and the Security Advisor reported `auth_leaked_password_protection` as disabled. Supabase's current password-security documentation states that hosted leaked-password protection is available on **Pro and above**. It cannot be enabled through SQL migrations or a client-side check, and no plan upgrade or billing change has been made.

For the current Free plan, use the available password-strength controls in **Authentication → Sign In / Providers → Email**:

- Set a minimum password length of at least **12 characters** for this single-administrator dashboard.
- Require digits, lowercase letters, uppercase letters and symbols.
- Keep public sign-ups disabled and use a unique password generated by a password manager.
- Enable MFA for the administrator account where practical.

These are fallback controls; they do **not** provide the breached-password database check. After changing Auth settings in the Dashboard, rerun the Supabase Security Advisor. If the organization moves to Pro or above, enable **Prevent use of leaked passwords** in the same Email provider settings and verify that the `auth_leaked_password_protection` warning disappears.

## Authentication setup

1. In Supabase Dashboard, open Authentication → Users and create the intended admin user.
2. Confirm the email address and use a strong, unique password.
3. Add the same email in lowercase to public.dashboard_admins and keep active = true.
4. Keep public sign-ups disabled after creating the intended administrator account.
5. Open https://ariakianzad.github.io/admin/ and sign in.

The homepage and book page hide the floating privacy-settings button after acceptance and keep it available after refusal. The blog always hides both the consent panel and the floating control; it still loads Google Analytics only when a saved consent grant exists. This is the live behaviour of `public/analytics-consent.js`, not a statement that Analytics runs without consent.

The dashboard's **«مرا به خاطر بسپار»** option is off by default. Only when a user explicitly enables it does the browser store the rotating Supabase refresh token in localStorage; the password and access token are not stored there. Same-origin JavaScript can nevertheless read local storage, so leave it disabled and use **خروج** on shared or public devices. Logout also requests local-session revocation from Supabase.

## Blog CMS and public contact form

The CMS uses public.blog_posts and public.blog_settings. Both tables have RLS enabled and direct privileges revoked from anon and authenticated. Drafts and the current working copy remain private. Publishing writes an immutable published_snapshot; the public build reads that snapshot through get_public_blog_payload. The public RPC returns only published posts and approved settings. It does not expose draft content or direct table access. The fetched payload is written to the ignored .cache/blog-content.json build cache and rendered into static article, category, RSS and sitemap outputs.

The blog-media Storage bucket is public-read because published article pages need to render images. Uploads are handled only by the authenticated blog-admin function. The function caps uploads at 3 MB, validates the declared MIME type against the file signature and uses a random storage path. The bucket permits WebP, JPEG, PNG and GIF.

The public blog-contact endpoint is unauthenticated by design. It checks the expected site Origin, accepts POST JSON, caps the body at 12 KB, validates fields and ignores a filled honeypot. It rate-limits to three accepted attempts per trusted client-IP fingerprint per hour and does not store raw IP addresses. It trusts only Cloudflare's managed `cf-connecting-ip` header; if the header is missing or malformed, it returns HTTP 503 instead of making every visitor share one `unknown` bucket. Single-line values such as the sender name have all control characters removed before the name is placed in the email subject. The multi-line message retains its line breaks and is HTML-escaped before being included in the email.

Cloudflare Turnstile integration is implemented but is **not active until both keys are configured**:
- Set the public site key as the GitHub Actions repository variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. The deployment workflow passes it into the static build; the widget is rendered on the contact page only when this variable is non-empty.
- Set the matching private secret as the Supabase Edge Function secret `CLOUDFLARE_TURNSTILE_SECRET_KEY`. The Edge Function sends every submitted token to Cloudflare's Siteverify endpoint and requires `success=true`, hostname `ariakianzad.github.io`, and action `blog_contact`.
- Configure the Turnstile widget to allow the hostname `ariakianzad.github.io`. Do not commit the secret key or place it in a public build variable.

Both keys must be configured together. If the server secret is absent, a request carrying a Turnstile token is rejected instead of being accepted without verification. Until the public site key is added, the pre-existing honeypot and IP rate limit remain active, but there is no CAPTCHA widget. A missing Cloudflare client-IP header fails closed. The function forwards messages to integrations/google-apps-script/blog-contact.gs using GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_TOKEN. The Apps Script stores its matching BLOG_CONTACT_TOKEN and destination BLOG_CONTACT_TO_EMAIL in Script Properties. The token is never sent to the browser. The script uses a lock and a short duplicate-submission cache and checks Google's daily email quota.



### Banner click event tracking

The deployed `blog-ad-click` function sends an HMAC fingerprint and the validated banner ID to `public.record_blog_ad_click`. The function uses the Cloudflare-managed `cf-connecting-ip` header; missing or malformed values are acknowledged but not counted. The rate-limit table is keyed by (fingerprint, banner_id), and the database permits at most ten registered events per pair per hour. This is an anti-abuse heuristic, not bot-proof measurement. A network with many legitimate visitors behind one public IP can be undercounted; a distributed attacker can still rotate IPs. The dashboard label therefore says "registered click events" and explicitly states that the number is not unique visitors. The public Origin header is forgeable and is not treated as authentication.

The click totals table remains inaccessible to `anon` and `authenticated`; only the server-side function/admin path can read or reset it. Historical totals in `public.blog_ad_click_counts` are preserved when the transient rate-limit key is migrated.

### Contact rate-limit table: live security finding

The live Security Advisor still reports RLS disabled on `private.blog_contact_rate_limits` as a critical finding on 2026-11-25. Direct privilege inspection on the same date confirmed that anon and authenticated have no SELECT or INSERT table grants; the SECURITY DEFINER rate-limit helper is owned by postgres and has a fixed `search_path = pg_catalog, private`. This means the current table is not directly queryable through the client roles based on the grants inspected, but RLS is still a worthwhile defense-in-depth control.

The safe hardening candidate is:

    ALTER TABLE private.blog_contact_rate_limits ENABLE ROW LEVEL SECURITY;

This SQL has **not** been applied. Do not add public client policies. Review the function owner, function grants and behaviour first; the SECURITY DEFINER function should continue to run as postgres, which bypasses RLS unless FORCE ROW LEVEL SECURITY is enabled. Do not enable FORCE RLS without re-testing the function.

The Advisor also reports `rls_enabled_no_policy` informational notices for public.dashboard_admins and public.download_snapshots. Those are intentional: RLS is enabled and browser roles have no direct table privileges. Do not add broad policies merely to clear these notices.

## Data and scheduled download snapshots

The database tables are:

- public.download_snapshots: one cumulative GitHub Release count per Tehran calendar date.
- public.dashboard_admins: active administrator email allowlist.

Both tables have RLS enabled, with browser-role privileges revoked. The Supabase Security Advisor may report rls_enabled_no_policy for these tables. That informational finding is expected for the current model: no browser role is granted table access, and the Edge Functions use server-side credentials. Do not add broad policies merely to silence the notice.

The GitHub Release API is public and returns the current cumulative asset count for Mian-e-Ma.pdf in tag mian-e-ma-v1. The dashboard can refresh the current day's snapshot on demand. A PostgreSQL Cron job named mian-e-ma-daily-download-snapshot also runs at **00:15 UTC (03:45 Asia/Tehran)**, even when nobody opens the dashboard.

The scheduled job runs private.capture_github_download_snapshot(), a private-schema function with a fixed search path and restricted execute privileges. It calls the GitHub Releases API through the http extension and upserts the cumulative count using the Tehran calendar date. Only the database postgres role can execute it; browser roles and the Edge Function service role cannot invoke it directly.

The daily count is derived from differences between cumulative snapshots. The first available snapshot is a baseline and cannot reconstruct earlier day-by-day activity. GitHub's count is not a count of unique people. Cron execution history is available in cron.job_run_details or the Supabase Integrations → Cron page.

## Google Analytics 4 and Search Console

The site-analytics Edge Function requests Google reporting data on behalf of the authenticated dashboard administrator.

- GA4 Property ID: 565407137
- GA4 Measurement ID: G-0CKL90M5R2
- Search Console property: https://ariakianzad.github.io/
- Required Supabase secret: GOOGLE_SERVICE_ACCOUNT_JSON

The function requests only these OAuth scopes:

- https://www.googleapis.com/auth/analytics.readonly
- https://www.googleapis.com/auth/webmasters.readonly

The service account needs **Viewer** access on the specified GA4 property and **Restricted** permission on the specified Search Console property. Project-wide Google Cloud Editor or Owner permissions are not required.

### One-time Google Cloud setup

1. Create a Google Cloud project and enable Google Analytics Data API and Google Search Console API.
2. Create a service account and generate a JSON key.
3. Copy the service account's client_email.
4. Add that email as Viewer under GA4 Admin → Property access management.
5. Add that email with Restricted permission in Search Console Settings → Users and permissions for the URL-prefix property above.

### Store the private key

1. Open Supabase Dashboard → Edge Functions → Secrets.
2. Add a secret named exactly GOOGLE_SERVICE_ACCOUNT_JSON.
3. Set its value to the complete service-account JSON file contents.
4. Keep the downloaded JSON file outside the repository and delete local copies when they are no longer needed.

Do not put the JSON key in GitHub Actions variables, public/admin/config.js, static HTML, chat messages or the repository. If it is exposed, revoke the key in Google Cloud and replace the Supabase secret.

The dashboard displays GA4 users, sessions, page views, file_download events, acquisition sources, page referrers and top pages. A GA4 file_download event records an interaction and is not proof the PDF was fully downloaded or opened. Search Console provides clicks, impressions, CTR, average position, queries, pages and devices.

GA4 reports cover a rolling 30-day range ending today (`29daysAgo` through `today`); the current day can be incomplete. The dashboard distinguishes a valid zero-valued summary from an empty or partial report and does not display a missing summary row as zero. Search Console reports cover a 30-day range ending three days before the current date to reduce the effect of incomplete recent data. Each provider's status is handled independently; an error from Google does not prevent GitHub download statistics from being returned.

## Migrations and deployments

The migration files in supabase/migrations/ create the tables, enable pg_cron and http, define the private snapshot function and schedule the daily job. The production project has these migrations applied. Do not edit already-applied migration files; add a new migration for any future database schema or function change.

Migration `20261124111304_responsive_article_advertising.sql` is now applied in production with the matching version recorded in Supabase. It preserves existing banner settings, stores per-banner `show_on_mobile` (default true), and provides a third disabled article-end slot; the first two slots remain in the article sidebar. Production schema verification confirmed the three-slot minimum and the per-banner mobile field. The deployed `blog-admin` Edge Function is version 11, and its source matches `main`. Do not apply this migration again.

To deploy a changed Edge Function with the Supabase CLI:

    supabase link --project-ref bkohdqwecnvbmeaiuyyx
    supabase functions deploy download-stats
    supabase functions deploy site-analytics
    supabase functions deploy blog-admin
    supabase functions deploy blog-contact
    supabase functions deploy blog-ad-click

The CLI reads the verify_jwt settings from supabase/config.toml. Function deployment replaces the live function version. Review the full source, dependency pin and authentication boundary first, then verify the deployed source and function version. Database migrations are a separate operation. The GitHub Pages workflow does not deploy Supabase Edge Functions or modify production database migrations.

### Migration history reconciliation

The production migration list was checked after the November 25 abuse-control migration. All 26 applied migration names map to exactly one local SQL file by migration name. Eleven of the 26 version timestamps match the local filename prefixes; 15 earlier timestamps still differ. The `responsive_article_advertising` migration is aligned at version `20261124111304` and is already applied. Supabase tracks applied migrations by version, not just the descriptive name. Do not run `supabase db push` until the remaining 15 version differences are reconciled, because the CLI may treat renamed-version files as pending migrations and attempt to run them again. Do not rename or edit already-applied production migrations. Record the exact version-to-file mapping and use a new migration version for future changes.
