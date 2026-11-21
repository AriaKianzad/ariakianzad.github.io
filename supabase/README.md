# Mian-e-Ma download dashboard

The dashboard is hosted at `https://ariakianzad.github.io/admin/` and reads the public GitHub Release asset counter for `Mian-e-Ma.pdf`.

## Supabase project

- Project: `mian-e-ma-analytics`
- Project ref: `bkohdqwecnvbmeaiuyyx`
- Region: `eu-central-1`
- Edge Function: `download-stats`

The Edge Function uses Supabase's built-in `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS` environment variables. No custom service-role key, GitHub token, or password is stored in this repository. The browser config contains only the project URL and publishable key.

## Security model

1. The dashboard is a static page. Its URL is not a security boundary.
2. Supabase Auth validates the email/password login.
3. The Edge Function independently validates the user's access token with Supabase Auth.
4. The authenticated email must also exist as an active row in `public.dashboard_admins`.
5. The Edge Function uses the built-in server-side Supabase secret key to access the database.
6. Both `download_snapshots` and `dashboard_admins` have Row Level Security enabled, and browser roles have no table privileges.
7. The login page can remember this browser by storing only the rotating Supabase refresh token in `localStorage`; it never stores the password or access token. Explicit logout removes the stored refresh token.

## Finish admin setup

1. In Supabase Dashboard, open **Authentication → Users** and create the one admin user. Use the email address you intend to enter on the dashboard and set a strong password. Mark the email as confirmed.
2. Add that exact email, in lowercase, to `public.dashboard_admins`. The user must be confirmed in Auth and present in this allowlist to see statistics.
3. Keep public sign-ups disabled after creating the admin user. Do not share the password or any secret key in chat or commit them to Git.
4. Open `https://ariakianzad.github.io/admin/` and sign in.

The public client configuration is in `public/admin/config.js`. It contains only the Supabase URL and publishable key, both designed for browser use.

## Database migrations

The migrations in `supabase/migrations/` create:

- `download_snapshots`: daily cumulative GitHub download totals.
- `dashboard_admins`: the private email allowlist for dashboard access.

Both migrations have been applied to the production project.

## Download history

GitHub exposes the current cumulative asset download count, not historical daily counts. A successful dashboard refresh records or updates the current day's snapshot using the Tehran calendar date. In addition, the Supabase Cron job `mian-e-ma-daily-download-snapshot` records a daily snapshot at 00:15 UTC (03:45 Asia/Tehran), even when the dashboard is not opened.

The scheduled PostgreSQL function `private.capture_github_download_snapshot()` reads the public GitHub Release API through the `http` extension and upserts the cumulative count into `public.download_snapshots`. It runs as the database's `postgres` role and is not executable by browser roles. The extensions `pg_cron` and `http` are enabled for this purpose; no GitHub token, Supabase admin token, additional Edge Function secret, or paid scheduler is needed.

The number represents downloads, not unique people. Daily figures are calculated as differences between cumulative snapshots. The first recorded day is a baseline and does not include older daily history. Cron runs can be inspected under Supabase **Integrations → Cron** or in `cron.job_run_details`.


## Google Analytics 4 and Search Console reporting

A second Edge Function, `site-analytics`, reads Google Analytics 4 and Google Search Console reports for the private dashboard.

- GA4 Property ID: `565407137`
- GA4 Measurement ID: `G-0CKL90M5R2`
- Search Console URL-prefix property: `https://ariakianzad.github.io/`
- Edge Function: `site-analytics`
- Required Supabase Edge Function secret: `GOOGLE_SERVICE_ACCOUNT_JSON`

The function requests only these Google OAuth scopes:

- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/webmasters.readonly`

It uses a Google service-account key stored only in Supabase Edge Function Secrets. Never add that JSON key to GitHub, the browser's `config.js`, or chat messages.

### One-time Google Cloud setup

1. Create a Google Cloud project. No billing account is needed for the GA4 Data API and Search Console API reporting used here.
2. Enable **Google Analytics Data API** and **Google Search Console API** in APIs & Services.
3. Create a service account. Project-wide Editor/Owner roles are not required; access to the two reporting properties is granted separately.
4. Create a JSON key for the service account and download it securely. Do not commit or share this file.
5. Copy the service account's `client_email`.
6. In GA4, open **Admin → Property access management** and add that email as **Viewer** to Property `565407137`.
7. In Search Console, open the property `https://ariakianzad.github.io/` → **Settings → Users and permissions** and add the same email with **Restricted** permission.

### Store the key in Supabase

1. Open **Supabase Dashboard → Project → Edge Functions → Secrets**.
2. Add a secret named exactly `GOOGLE_SERVICE_ACCOUNT_JSON`.
3. Paste the complete contents of the downloaded service-account JSON file as its value.
4. Save the secret. Do not send the key to anyone or place it in the repository.

Then sign in to `https://ariakianzad.github.io/admin/` and select **به‌روزرسانی آمار**. The dashboard calls `site-analytics` using the existing Supabase session and admin allowlist.

The dashboard reports GA4 users, sessions, page views, file-download events, session source/medium, page referrers on `/Mian-e-Ma/`, and top pages. Search Console reports clicks, impressions, CTR, average position, top queries, pages, and devices. GA4 reports cover the previous 30 complete days; Search Console ends three days before the current date to reduce incomplete-day results.

If one Google product has not granted access, its section displays its error independently; download statistics remain available.
