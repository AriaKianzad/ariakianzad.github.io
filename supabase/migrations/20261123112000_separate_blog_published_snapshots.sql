-- Keep published content immutable while an author edits the working draft.
alter table public.blog_posts
  add column if not exists published_snapshot jsonb;

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
          'default_og_image', s.default_og_image, 'footer_note', s.footer_note, 'category_seo', s.category_seo
        ) from public.blog_settings s where s.id = 1
      ), '{}'::jsonb
    ),
    'posts',
    coalesce(
      (
        select jsonb_agg(p.published_snapshot order by p.published_at desc, p.created_at desc)
        from public.blog_posts p
        where p.status = 'published' and p.published_at is not null
          and p.published_at <= now() and p.published_snapshot is not null
      ), '[]'::jsonb
    )
  );
$function$;
