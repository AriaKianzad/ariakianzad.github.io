alter table public.blog_settings
  add column if not exists canonical_url text not null default '';

update public.blog_settings
set canonical_url = 'https://ariakianzad.github.io/blog/'
where id = 1 and btrim(coalesce(canonical_url, '')) = '';

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
        'twitter_card_type', s.twitter_card_type
      )
      from public.blog_settings s
      where s.id = 1
    ),
    '{}'::jsonb
  );
$function$;
