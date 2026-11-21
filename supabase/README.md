# Mian-e-Ma analytics backend

The private dashboard frontend is hosted at https://ariakianzad.github.io/admin/. Its HTML, CSS, JavaScript and public client configuration are visible to everyone. Supabase is responsible for authentication, authorization and access to analytics data.

## Project

- Supabase project: mian-e-ma-analytics
- Project ref: bkohdqwecnvbmeaiuyyx
- Region: eu-central-1
- Edge Functions: download-stats, site-analytics
- Database schema: public plus a private schema for the scheduled snapshot function

The source for both deployed Edge Functions is tracked in this repository:

- supabase/functions/download-stats/index.ts
- supabase/functions/site-analytics/index.ts

The deployed versions were checked against the Supabase project during the repository review. Keep the tracked source and deployed function in sync when making changes.

## Security and authorization model

1. The browser signs in through Supabase Auth using the public publishable key in public/admin/config.js.
2. The browser sends its Supabase access token to the Edge Function.
3. Each function verifies the token with Supabase Auth using auth.getUser(token); it does not trust an unverified JWT payload.
4. The user must have a confirmed email and an active matching lowercase email in public.dashboard_admins.
5. Only after these checks does the function use server-side Supabase credentials to read/write dashboard data or request Google reports.
6. Both public.dashboard_admins and public.download_snapshots have RLS enabled. Browser roles anon and authenticated have no table privileges; the functions access the tables with server-side credentials.

The two functions have verify_jwt = false in supabase/config.toml because they implement their own explicit access-token validation and allowlist check. This is intentional. Do not remove the checks in the function handlers or change verify_jwt without reviewing the complete authentication flow.

The client configuration contains only the Supabase project URL and an sb_publishable_ key. Publishable keys are intended for browser use. Never put a Supabase secret key, legacy service-role key, GitHub token or Google private key in public/admin/config.js, any other browser asset or Git history.

## Authentication setup

1. In Supabase Dashboard, open Authentication → Users and create the intended admin user.
2. Confirm the email address and use a strong, unique password.
3. Add the same email in lowercase to public.dashboard_admins and keep active = true.
4. Keep public sign-ups disabled after creating the intended administrator account.
5. Open https://ariakianzad.github.io/admin/ and sign in.

The dashboard's **«مرا به خاطر بسپار»** option stores only the rotating Supabase refresh token in localStorage. It does not store the password or access token. Same-origin JavaScript can nevertheless read local storage, so disable the option and use **خروج** on a shared or public device.

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

GA4 reports cover the previous 30 complete days through yesterday. Search Console reports end three days before the current date to reduce the effect of incomplete recent data. Each provider's status is handled independently; an error from Google does not prevent GitHub download statistics from being returned.

## Migrations and deployments

The migration files in supabase/migrations/ create the tables, enable pg_cron and http, define the private snapshot function and schedule the daily job. The production project has these migrations applied. Do not edit already-applied migration files; add a new migration for any future database schema or function change.

To deploy a changed Edge Function with the Supabase CLI:

    supabase link --project-ref bkohdqwecnvbmeaiuyyx
    supabase functions deploy download-stats
    supabase functions deploy site-analytics

The CLI reads verify_jwt = false from supabase/config.toml. Function deployment replaces the live function version, so review the full source and confirm its authentication checks before deploying. Database migrations are separate from Edge Function deployment.
