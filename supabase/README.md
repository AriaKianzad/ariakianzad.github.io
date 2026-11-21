# Mian-e-Ma download dashboard

This folder contains the private analytics UI and its Supabase Edge Function backend.

- Static admin UI: `public/admin/`
- Supabase Edge Function: `supabase/functions/download-stats/`
- Database migration: `supabase/migrations/`

The dashboard reads the public GitHub Release asset counter for `Mian-e-Ma.pdf`. The GitHub API is read-only and does not need a GitHub token. Supabase Auth protects the dashboard; the Edge Function checks the signed-in user's email against one server-side allowlist before it returns any analytics.

## Security model

1. The dashboard is a static page on GitHub Pages. Its URL is not a security boundary.
2. Supabase Auth validates the email/password login.
3. The Edge Function independently verifies the user's access token and checks that the account email matches `DASHBOARD_ADMIN_EMAIL`.
4. Only the Edge Function uses `DASHBOARD_SUPABASE_SECRET_KEY` to read and write the snapshots table. The browser never receives that key.
5. Row Level Security is enabled and browser roles have no privileges on `download_snapshots`.
6. The browser config contains only the Supabase URL and publishable key. Those values are intended to be public.

Do not commit Supabase secret keys, passwords, cron secrets, or service-role keys. Do not put them in `public/admin/config.js`.

## One-time Supabase setup

The repository has the code, but the backend must be deployed to your Supabase project.

### 1. Create the admin account

In Supabase Dashboard, open **Authentication → Users** and invite the email address that will own this dashboard. Complete the invitation and set a strong password. Use this same email for `DASHBOARD_ADMIN_EMAIL`.

For a single-admin dashboard, turn off public sign-ups after the admin account exists. Keep email confirmation enabled.

### 2. Apply the database migration

From the repository root, link the Supabase CLI to your project and push the migration:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Alternatively, copy and run `supabase/migrations/20261121000000_create_download_snapshots.sql` in the Supabase SQL Editor.

### 3. Set Edge Function secrets

In Supabase Dashboard, open **Edge Functions → Secrets**, or set them with the CLI. The project URL is injected by Supabase as `SUPABASE_URL`. Set these four secrets:

- `DASHBOARD_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key (or legacy anon key).
- `DASHBOARD_SUPABASE_SECRET_KEY`: a server-side Supabase secret key (or legacy service-role key). Never expose this in the browser.
- `DASHBOARD_ADMIN_EMAIL`: the exact admin email, in lowercase.
- `DASHBOARD_CRON_SECRET`: a long random secret, used only by the scheduled daily sync.

PowerShell CLI example (replace the values locally; do not paste secret values into chat or commit them):

```powershell
supabase secrets set DASHBOARD_SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY" DASHBOARD_SUPABASE_SECRET_KEY="YOUR_SERVER_SIDE_SECRET_KEY" DASHBOARD_ADMIN_EMAIL="YOUR_ADMIN_EMAIL" DASHBOARD_CRON_SECRET="YOUR_LONG_RANDOM_SECRET"
```

### 4. Deploy the Edge Function

Run this from the repository root:

```powershell
supabase functions deploy download-stats --no-verify-jwt
```

The function disables the gateway's JWT check because it validates Supabase Auth access tokens itself and also accepts a separate cron-secret request. Do not remove the validation inside `index.ts`.

### 5. Configure the public browser settings

Copy the Project URL and publishable key from **Project Settings → API Keys** into `public/admin/config.js`:

```js
window.MIAN_E_MA_DASHBOARD_CONFIG = Object.freeze({
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY"
});
```

Only the URL and publishable/anon key belong here. Never add the secret/service-role key.

Commit and push the updated config file. GitHub Pages will deploy the static admin page at:

`https://ariakianzad.github.io/admin/`

## Daily snapshots for the chart

GitHub exposes the current total download count, not a historical daily series. The Edge Function saves a snapshot when the dashboard is refreshed. To create a reliable daily time series even when the dashboard is not opened, enable `pg_cron`, `pg_net`, and Vault in the Supabase project, then run the following in the SQL Editor.

First, store the exact same random value used for `DASHBOARD_CRON_SECRET` as a Vault secret:

```sql
select vault.create_secret(
  'PASTE_THE_SAME_CRON_SECRET_HERE',
  'mian_e_ma_cron_secret',
  'Secret used by the Mian-e-Ma daily download snapshot job'
);

select vault.create_secret(
  'PASTE_THE_DASHBOARD_SUPABASE_SECRET_KEY_HERE',
  'mian_e_ma_supabase_key',
  'Server-side key used only by the Mian-e-Ma scheduled snapshot job'
);
```

Then create the schedule. Replace `YOUR_PROJECT_REF` with the project ref. The cron expression runs at 20:35 UTC, which is 00:05 the next day in Iran (Asia/Tehran).

```sql
select cron.schedule(
  'mian-e-ma-daily-download-snapshot',
  '35 20 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/download-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mian_e_ma_supabase_key'
        limit 1
      ),
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mian_e_ma_cron_secret'
        limit 1
      )
    ),
    body := jsonb_build_object('mode', 'sync')
  );
  $$
);
```

The scheduled request contains no user credentials and cannot retrieve dashboard data. It can only trigger a daily snapshot when its secret matches.

If the cron job is not configured, the current total and snapshots on days when you open/refresh the dashboard still work, but the daily chart will have gaps. If a scheduled snapshot is missed, the change is attributed to the next recorded day because GitHub does not provide historic daily download counts.

## What the dashboard shows

- Total PDF downloads from the GitHub Release asset.
- Today's delta, based on Tehran calendar date.
- Seven-day and thirty-day totals from stored snapshots.
- A selectable 7 / 30 / 90 day trend chart.
- The most recent daily snapshots and last refresh time.

The number is downloads, not unique people. The initial daily trend starts when snapshots begin; GitHub does not expose historic daily data.
