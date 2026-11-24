-- Preserve configured global ad slots while adding responsive visibility and
-- a dedicated thin banner immediately after every article body.
alter table public.blog_settings
  alter column ad_banners set default
  '[
    {"id":"banner-1","enabled":false,"label":"","image_url":"","alt":"","link_url":"","link_rel":"follow","show_on_mobile":true},
    {"id":"banner-2","enabled":false,"label":"","image_url":"","alt":"","link_url":"","link_rel":"follow","show_on_mobile":true},
    {"id":"banner-3","enabled":false,"label":"","image_url":"","alt":"","link_url":"","link_rel":"follow","show_on_mobile":true}
  ]'::jsonb;

do $migration$
begin
  if exists (
    select 1
    from public.blog_settings settings
    where settings.id = 1
      and jsonb_typeof(settings.ad_banners) = 'array'
      and jsonb_array_length(settings.ad_banners) >= 8
      and not exists (
        select 1
        from jsonb_array_elements(settings.ad_banners) as banners(item)
        where banners.item ->> 'id' = 'banner-3'
      )
  ) then
    raise exception 'Cannot add the required article-end banner because all eight advertising slots are already occupied.';
  end if;
end;
$migration$;

update public.blog_settings settings
set ad_banners =
  (
    select coalesce(
      jsonb_agg(
        case
          when jsonb_typeof(entries.item -> 'show_on_mobile') = 'boolean'
            then entries.item
          else entries.item || jsonb_build_object('show_on_mobile', true)
        end
        order by entries.ordinality
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(coalesce(settings.ad_banners, '[]'::jsonb))
      with ordinality as entries(item, ordinality)
  )
  ||
  case
    when exists (
      select 1
      from jsonb_array_elements(coalesce(settings.ad_banners, '[]'::jsonb)) as entries(item)
      where entries.item ->> 'id' = 'banner-3'
    ) then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object(
      'id', 'banner-3',
      'enabled', false,
      'label', '',
      'image_url', '',
      'alt', '',
      'link_url', '',
      'link_rel', 'follow',
      'show_on_mobile', true
    ))
  end
where settings.id = 1;

alter table public.blog_settings
  drop constraint if exists blog_settings_ad_banners_array_check;

alter table public.blog_settings
  add constraint blog_settings_ad_banners_array_check
  check (
    jsonb_typeof(ad_banners) = 'array'
    and jsonb_array_length(ad_banners) between 3 and 8
  );
