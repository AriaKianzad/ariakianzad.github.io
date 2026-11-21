create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to postgres;

create or replace function private.capture_github_download_snapshot()
returns table (
  snapshot_date date,
  total_downloads integer,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, private
as $function$
declare
  response_status integer;
  release_payload jsonb;
  asset_downloads integer;
  snapshot_day date := (clock_timestamp() at time zone 'Asia/Tehran')::date;
  snapshot_recorded_at timestamptz := clock_timestamp();
begin
  select response.status, response.content::jsonb
    into response_status, release_payload
  from extensions.http_get(
    'https://api.github.com/repos/AriaKianzad/ariakianzad.github.io/releases/tags/mian-e-ma-v1'
  ) as response;

  if response_status is distinct from 200 then
    raise exception 'GitHub Releases API returned HTTP %', response_status;
  end if;

  if jsonb_typeof(release_payload -> 'assets') is distinct from 'array' then
    raise exception 'GitHub Release response does not contain an assets array.';
  end if;

  select (asset ->> 'download_count')::integer
    into asset_downloads
  from jsonb_array_elements(release_payload -> 'assets') as asset
  where asset ->> 'name' = 'Mian-e-Ma.pdf'
  limit 1;

  if asset_downloads is null or asset_downloads < 0 then
    raise exception 'The expected Mian-e-Ma.pdf asset or its download count was not found.';
  end if;

  insert into public.download_snapshots (
    snapshot_date,
    total_downloads,
    recorded_at
  )
  values (
    snapshot_day,
    asset_downloads,
    snapshot_recorded_at
  )
  on conflict (snapshot_date) do update
    set total_downloads = excluded.total_downloads,
        recorded_at = excluded.recorded_at;

  return query
  select snapshot_day, asset_downloads, snapshot_recorded_at;
end;
$function$;

revoke all on function private.capture_github_download_snapshot() from public;
revoke all on function private.capture_github_download_snapshot() from anon, authenticated, service_role;
grant execute on function private.capture_github_download_snapshot() to postgres;

comment on function private.capture_github_download_snapshot()
is 'Fetches the public GitHub Release asset download_count and upserts one Asia/Tehran daily cumulative snapshot. Executed only by the scheduled postgres cron job.';
