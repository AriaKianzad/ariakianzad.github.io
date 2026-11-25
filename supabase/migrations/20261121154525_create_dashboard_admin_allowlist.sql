create table if not exists public.dashboard_admins (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.dashboard_admins enable row level security;
revoke all on table public.dashboard_admins from anon, authenticated;
grant all on table public.dashboard_admins to service_role;
