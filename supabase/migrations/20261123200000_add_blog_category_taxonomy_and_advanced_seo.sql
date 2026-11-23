-- Explicit category taxonomy with English slugs and Persian labels, plus global SEO defaults.
alter table public.blog_settings
  add column if not exists categories jsonb not null default '[]'::jsonb,
  add column if not exists default_og_title text not null default '',
  add column if not exists default_og_description text not null default '',
  add column if not exists default_robots_index boolean not null default true,
  add column if not exists default_robots_follow boolean not null default true,
  add column if not exists noindex_empty_categories boolean not null default true,
  add column if not exists sitemap_include_categories boolean not null default true,
  add column if not exists sitemap_include_articles boolean not null default true,
  add column if not exists schema_type text not null default 'Article',
  add column if not exists breadcrumbs_enabled boolean not null default true,
  add column if not exists breadcrumb_home_label text not null default 'خانه',
  add column if not exists open_graph_enabled boolean not null default true,
  add column if not exists twitter_card_type text not null default 'summary_large_image';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'blog_settings_categories_array_check') then
    alter table public.blog_settings
      add constraint blog_settings_categories_array_check
      check (jsonb_typeof(categories) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_settings_schema_type_check') then
    alter table public.blog_settings
      add constraint blog_settings_schema_type_check
      check (schema_type in ('Article', 'BlogPosting'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_settings_twitter_card_type_check') then
    alter table public.blog_settings
      add constraint blog_settings_twitter_card_type_check
      check (twitter_card_type in ('summary', 'summary_large_image'));
  end if;
end $$;

-- Migrate the current Persian category label to a stable English URL slug.
update public.blog_posts
set category = 'brand-and-business'
where category = 'برند و کسب‌وکار';

update public.blog_posts
set published_snapshot = jsonb_set(
  published_snapshot,
  '{category}',
  to_jsonb('brand-and-business'::text),
  true
)
where published_snapshot is not null
  and published_snapshot->>'category' = 'برند و کسب‌وکار';

update public.blog_settings
set categories = jsonb_build_array(
  jsonb_build_object('slug', 'brand-and-business', 'name', 'برند و کسب‌وکار')
)
where id = 1
  and jsonb_array_length(categories) = 0
  and exists (select 1 from public.blog_posts where category = 'brand-and-business');

-- Expose only an intentionally curated set of public taxonomy and SEO defaults.
create or replace function private.blog_get_public_blog_settings_extras()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select coalesce(
    (
      select jsonb_build_object(
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
        'twitter_card_type', s.twitter_card_type
      )
      from public.blog_settings s
      where s.id = 1
    ),
    '{}'::jsonb
  );
$function$;

revoke all on function private.blog_get_public_blog_settings_extras() from public;
grant execute on function private.blog_get_public_blog_settings_extras() to anon, authenticated;

create or replace function public.get_public_blog_payload()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $function$
  select jsonb_set(
    private.blog_get_public_payload(),
    '{settings}',
    coalesce(private.blog_get_public_payload()->'settings', '{}'::jsonb)
      || private.blog_get_public_blog_settings_extras(),
    true
  );
$function$;

revoke all on function public.get_public_blog_payload() from public, anon, authenticated;
grant execute on function public.get_public_blog_payload() to anon, authenticated;
