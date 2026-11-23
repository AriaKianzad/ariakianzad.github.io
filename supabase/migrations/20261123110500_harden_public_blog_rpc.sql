-- Keep the only SECURITY DEFINER accessor outside the exposed API schemas.
-- Public PostgREST calls reach it through a SECURITY INVOKER wrapper.
create schema if not exists private authorization postgres;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.blog_get_public_payload()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'settings',
    coalesce(
      (
        select jsonb_build_object(
          'id', s.id, 'title', s.title, 'tagline', s.tagline, 'description', s.description,
          'background_theme', s.background_theme, 'accent_color', s.accent_color, 'card_style', s.card_style,
          'layout_style', s.layout_style, 'content_width', s.content_width, 'posts_per_page', s.posts_per_page,
          'show_search', s.show_search, 'show_categories', s.show_categories, 'show_featured', s.show_featured,
          'show_reading_time', s.show_reading_time, 'show_toc', s.show_toc,
          'show_related_posts', s.show_related_posts, 'show_share', s.show_share, 'enable_rss', s.enable_rss,
          'default_language', s.default_language, 'heading_scale', s.heading_scale,
          'body_line_height', s.body_line_height, 'intro_title', s.intro_title, 'intro_body', s.intro_body,
          'default_meta_title', s.default_meta_title, 'default_meta_description', s.default_meta_description,
          'default_og_image', s.default_og_image, 'footer_note', s.footer_note
        )
        from public.blog_settings s where s.id = 1
      ), '{}'::jsonb
    ),
    'posts',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id, 'slug', p.slug, 'title', p.title, 'excerpt', p.excerpt, 'content', p.content,
            'language', p.language, 'category', p.category, 'tags', p.tags,
            'hero_image_url', p.hero_image_url, 'hero_image_alt', p.hero_image_alt,
            'hero_image_caption', p.hero_image_caption, 'og_image_url', p.og_image_url,
            'seo_title', p.seo_title, 'meta_description', p.meta_description, 'focus_keyword', p.focus_keyword,
            'canonical_url', p.canonical_url, 'og_title', p.og_title, 'og_description', p.og_description,
            'robots_index', p.robots_index, 'robots_follow', p.robots_follow, 'featured', p.featured,
            'toc_enabled', p.toc_enabled, 'drop_cap', p.drop_cap, 'content_width', p.content_width,
            'accent_color', p.accent_color, 'faqs', p.faqs,
            'published_at', p.published_at, 'created_at', p.created_at, 'updated_at', p.updated_at
          )
          order by p.published_at desc, p.created_at desc
        )
        from public.blog_posts p
        where p.status = 'published' and p.published_at is not null and p.published_at <= now()
      ), '[]'::jsonb
    )
  );
$function$;

revoke all on function private.blog_get_public_payload() from public, anon, authenticated;
grant execute on function private.blog_get_public_payload() to anon, authenticated;

create or replace function public.get_public_blog_payload()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $function$
  select private.blog_get_public_payload();
$function$;

revoke all on function public.get_public_blog_payload() from public, anon, authenticated;
grant execute on function public.get_public_blog_payload() to anon, authenticated;
