-- Make click throttling specific to a banner and a trusted client fingerprint.
-- The rate-limit table contains short-lived anti-abuse state only; clearing it
-- does not modify the reporting totals in public.blog_ad_click_counts.
alter table private.blog_ad_click_rate_limits
  add column if not exists banner_id text;

delete from private.blog_ad_click_rate_limits;

alter table private.blog_ad_click_rate_limits
  drop constraint if exists blog_ad_click_rate_limits_pkey;

alter table private.blog_ad_click_rate_limits
  alter column banner_id set not null;

alter table private.blog_ad_click_rate_limits
  add constraint blog_ad_click_rate_limits_pkey
  primary key (fingerprint, banner_id);

alter table private.blog_ad_click_rate_limits
  add constraint blog_ad_click_rate_limits_banner_id_check
  check (banner_id ~ '^banner-[1-9][0-9]*$');

create or replace function public.record_blog_ad_click(
  p_banner_id text,
  p_fingerprint text
)
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $function$
declare
  v_banner jsonb;
  v_request_count integer;
  v_click_count bigint;
  v_now timestamptz := clock_timestamp();
begin
  if p_banner_id is null or p_banner_id !~ '^banner-[1-9][0-9]*$' then
    raise exception 'Invalid banner ID.' using errcode = '22023';
  end if;

  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid click fingerprint.' using errcode = '22023';
  end if;

  select banners.item
    into v_banner
  from public.blog_settings as settings
  cross join lateral jsonb_array_elements(settings.ad_banners) as banners(item)
  where settings.id = 1
    and banners.item ->> 'id' = p_banner_id
    and banners.item ->> 'enabled' = 'true'
    and coalesce(banners.item ->> 'image_url', '') <> ''
    and coalesce(banners.item ->> 'link_url', '') <> ''
  limit 1;

  if v_banner is null then
    return null;
  end if;

  insert into private.blog_ad_click_rate_limits as limits (
    fingerprint,
    banner_id,
    window_started_at,
    request_count
  )
  values (p_fingerprint, p_banner_id, v_now, 1)
  on conflict (fingerprint, banner_id) do update
    set window_started_at = case
          when limits.window_started_at <= v_now - interval '1 hour' then v_now
          else limits.window_started_at
        end,
        request_count = case
          when limits.window_started_at <= v_now - interval '1 hour' then 1
          else limits.request_count + 1
        end
  returning request_count into v_request_count;

  -- Count at most ten registered click events per banner and fingerprint per hour.
  if v_request_count > 10 then
    return null;
  end if;

  insert into public.blog_ad_click_counts as totals (
    banner_id,
    click_count,
    reset_at,
    updated_at
  )
  values (p_banner_id, 1, v_now, v_now)
  on conflict (banner_id) do update
    set click_count = totals.click_count + 1,
        updated_at = excluded.updated_at
  returning click_count into v_click_count;

  return v_click_count;
end;
$function$;

revoke all on function public.record_blog_ad_click(text, text) from public, anon, authenticated;
grant execute on function public.record_blog_ad_click(text, text) to service_role;

-- Move contact-rate cleanup out of the hot path. The old function deleted
-- expired rows on every request; a daily job is sufficient for this table.
create or replace function private.consume_blog_contact_rate_limit(p_fingerprint text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  current_time_value timestamptz := pg_catalog.now();
  current_count integer;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  insert into private.blog_contact_rate_limits as current_limit (
    fingerprint,
    window_started_at,
    request_count
  )
  values (p_fingerprint, current_time_value, 1)
  on conflict (fingerprint) do update
  set
    window_started_at = case
      when current_limit.window_started_at <= current_time_value - interval '1 hour'
        then current_time_value
      else current_limit.window_started_at
    end,
    request_count = case
      when current_limit.window_started_at <= current_time_value - interval '1 hour'
        then 1
      else current_limit.request_count + 1
    end
  returning request_count into current_count;

  return current_count <= 3;
end;
$function$;

do $schedule$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname = 'blog-contact-rate-limit-cleanup'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'blog-contact-rate-limit-cleanup',
    '19 3 * * *',
    $command$delete from private.blog_contact_rate_limits
             where window_started_at < now() - interval '2 days';$command$
  );
end;
$schedule$;
