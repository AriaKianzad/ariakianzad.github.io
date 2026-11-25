-- Move advertising controls from individual posts to global blog settings.
alter table public.blog_settings
  add column if not exists ad_banners jsonb not null default
  '[
    {"id":"banner-1","enabled":false,"label":"","image_url":"","alt":"","link_url":"","link_rel":"follow"},
    {"id":"banner-2","enabled":false,"label":"","image_url":"","alt":"","link_url":"","link_rel":"follow"}
  ]'::jsonb;

update public.blog_settings
set ad_banners = '[
  {"id":"banner-1","enabled":false,"label":"","image_url":"","alt":"","link_url":"","link_rel":"follow"},
  {"id":"banner-2","enabled":false,"label":"","image_url":"","alt":"","link_url":"","link_rel":"follow"}
]'::jsonb
where ad_banners is null or jsonb_typeof(ad_banners) <> 'array';

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'blog_settings_ad_banners_array_check'
      and conrelid = 'public.blog_settings'::regclass
  ) then
    alter table public.blog_settings
      add constraint blog_settings_ad_banners_array_check
      check (
        jsonb_typeof(ad_banners) = 'array'
        and jsonb_array_length(ad_banners) between 2 and 8
      );
  end if;
end;
$migration$;

-- GIFs are stored as original files so animated banners remain animated.
update storage.buckets
set allowed_mime_types = case
  when 'image/gif' = any(coalesce(allowed_mime_types, array[]::text[]))
    then allowed_mime_types
  else array_append(coalesce(allowed_mime_types, array[]::text[]), 'image/gif')
end
where id = 'blog-media';

-- The previous per-post banner experiment had no configured records. Remove its
-- article-level fields now that advertising is managed globally.
alter table public.blog_posts
  drop constraint if exists blog_posts_ad_banner_enabled_requires_content,
  drop constraint if exists blog_posts_ad_banner_link_must_be_https,
  drop column if exists ad_banner_enabled,
  drop column if exists ad_banner_image_url,
  drop column if exists ad_banner_alt,
  drop column if exists ad_banner_link_url;

create or replace function private.blog_get_public_blog_settings_extras()
returns jsonb
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $function$
  select coalesce(
    (
      select jsonb_build_object(
        'canonical_url', s.canonical_url,
        'categories', s.categories,
        'category_seo', s.category_seo,
        'default_og_title', s.default_og_title,
        'default_og_description', s.default_og_description,
        'default_robots_index', s.default_robots_index,
        'default_robots_follow', s.default_robots_follow,
        'noindex_empty_categories', s.noindex_empty_categories,
        'sitemap_include_categories', s.sitemap_include_categories,
        'sitemap_include_articles', s.sitemap_include_articles,
        'schema_type', s.schema_type,
        'breadcrumbs_enabled', s.breadcrumbs_enabled,
        'breadcrumb_home_label', s.breadcrumb_home_label,
        'open_graph_enabled', s.open_graph_enabled,
        'twitter_card_type', s.twitter_card_type,
        'ad_banners', s.ad_banners
      )
      from public.blog_settings s
      where s.id = 1
    ),
    '{}'::jsonb
  );
$function$;
