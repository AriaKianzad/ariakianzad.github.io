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

GitHub exposes the current cumulative asset download count, not historical daily counts. Every successful dashboard refresh records or updates the current day's snapshot using the Tehran calendar date. The dashboard can calculate day-to-day deltas once snapshots exist, but days when the dashboard is not opened will not have a snapshot. The first recorded day is a baseline and does not include older daily history.

The number represents downloads, not unique people. A scheduled daily snapshot job can be added separately if a continuous daily chart is required.
