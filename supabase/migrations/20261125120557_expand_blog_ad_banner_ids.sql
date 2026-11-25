-- Custom banner slots may be removed and replaced over time. IDs therefore
-- remain stable but are not limited to the currently visible slot count.
alter table public.blog_ad_click_counts
  drop constraint if exists blog_ad_click_counts_banner_id_check;

alter table public.blog_ad_click_counts
  add constraint blog_ad_click_counts_banner_id_check
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
    window_started_at,
    request_count
  )
  values (p_fingerprint, v_now, 1)
  on conflict (fingerprint) do update
    set window_started_at = case
          when limits.window_started_at < v_now - interval '1 minute' then v_now
          else limits.window_started_at
        end,
        request_count = case
          when limits.window_started_at < v_now - interval '1 minute' then 1
          else limits.request_count + 1
        end
  returning request_count into v_request_count;

  if v_request_count > 60 then
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

create or replace function public.reset_blog_ad_click_count(p_banner_id text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
begin
  if p_banner_id is null or p_banner_id !~ '^banner-[1-9][0-9]*$' then
    raise exception 'Invalid banner ID.' using errcode = '22023';
  end if;

  insert into public.blog_ad_click_counts as totals (
    banner_id,
    click_count,
    reset_at,
    updated_at
  )
  values (p_banner_id, 0, v_now, v_now)
  on conflict (banner_id) do update
    set click_count = 0,
        reset_at = excluded.reset_at,
        updated_at = excluded.updated_at
  returning jsonb_build_object(
    'banner_id', totals.banner_id,
    'click_count', totals.click_count,
    'reset_at', totals.reset_at,
    'updated_at', totals.updated_at
  ) into v_result;

  return v_result;
end;
$function$;
