-- Daily snapshots of the GitHub Release asset download counter.
-- Browser roles cannot read this table. Only the Edge Function's server-side
-- Supabase secret key can access it.
create table if not exists public.download_snapshots (
  snapshot_date date primary key,
  total_downloads integer not null check (total_downloads >= 0),
  recorded_at timestamptz not null default now()
);

alter table public.download_snapshots enable row level security;

revoke all on table public.download_snapshots from anon, authenticated;
grant all on table public.download_snapshots to service_role;
