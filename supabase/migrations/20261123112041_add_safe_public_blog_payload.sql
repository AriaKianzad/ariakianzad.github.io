-- Add editor customization fields and an explicit public settings payload.
alter table public.blog_settings
  add column if not exists layout_style text not null default 'editorial',
  add column if not exists content_width text not null default 'reading',
  add column if not exists show_toc boolean not null default true,
  add column if not exists show_related_posts boolean not null default true,
  add column if not exists show_share boolean not null default true,
  add column if not exists enable_rss boolean not null default true,
  add column if not exists default_language text not null default 'fa',
  add column if not exists heading_scale numeric not null default 1.0,
  add column if not exists body_line_height numeric not null default 1.95,
  add column if not exists intro_title text not null default '',
  add column if not exists intro_body text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'blog_settings_layout_style_check') then
    alter table public.blog_settings add constraint blog_settings_layout_style_check
      check (layout_style = any (array['editorial','minimal','magazine']));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_settings_content_width_check') then
    alter table public.blog_settings add constraint blog_settings_content_width_check
      check (content_width = any (array['reading','wide']));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_settings_default_language_check') then
    alter table public.blog_settings add constraint blog_settings_default_language_check
      check (default_language = any (array['fa','en']));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_settings_heading_scale_check') then
    alter table public.blog_settings add constraint blog_settings_heading_scale_check
      check (heading_scale between 0.85 and 1.2);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_settings_body_line_height_check') then
    alter table public.blog_settings add constraint blog_settings_body_line_height_check
      check (body_line_height between 1.6 and 2.4);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_settings_accent_color_check') then
    alter table public.blog_settings add constraint blog_settings_accent_color_check
      check (accent_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_posts_accent_color_check') then
    alter table public.blog_posts add constraint blog_posts_accent_color_check
      check (accent_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

insert into public.blog_settings (id)
values (1)
on conflict (id) do nothing;

update public.blog_settings
set description = case when description = ''
      then 'مقاله‌ها و یادداشت‌های آریا کیانزاد درباره استراتژی برند، جایگاه‌یابی، ارتباطات و پرسونال برندینگ.'
      else description end,
    background_theme = 'paper',
    accent_color = case when accent_color = '#405a42' then '#a86f54' else accent_color end,
    layout_style = 'editorial',
    content_width = 'reading',
    default_meta_title = case when default_meta_title = 'وبلاگ آریا کیانزاد'
      then 'وبلاگ آریا کیانزاد | استراتژی برند و پرسونال برندینگ' else default_meta_title end,
    default_meta_description = case when default_meta_description = ''
      then 'یادداشت‌ها و مقاله‌های آریا کیانزاد درباره استراتژی برند، جایگاه‌یابی، هویت و ارتباطات.'
      else default_meta_description end,
    updated_at = now()
where id = 1;

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
          'id', s.id,
          'title', s.title,
          'tagline', s.tagline,
          'description', s.description,
          'background_theme', s.background_theme,
          'accent_color', s.accent_color,
          'card_style', s.card_style,
          'layout_style', s.layout_style,
          'content_width', s.content_width,
          'posts_per_page', s.posts_per_page,
          'show_search', s.show_search,
          'show_categories', s.show_categories,
          'show_featured', s.show_featured,
          'show_reading_time', s.show_reading_time,
          'show_toc', s.show_toc,
          'show_related_posts', s.show_related_posts,
          'show_share', s.show_share,
          'enable_rss', s.enable_rss,
          'default_language', s.default_language,
          'heading_scale', s.heading_scale,
          'body_line_height', s.body_line_height,
          'intro_title', s.intro_title,
          'intro_body', s.intro_body,
          'default_meta_title', s.default_meta_title,
          'default_meta_description', s.default_meta_description,
          'default_og_image', s.default_og_image,
          'footer_note', s.footer_note
        )
        from public.blog_settings s where s.id = 1
      ),
      '{}'::jsonb
    ),
    'posts',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'slug', p.slug,
            'title', p.title,
            'excerpt', p.excerpt,
            'content', p.content,
            'language', p.language,
            'category', p.category,
            'tags', p.tags,
            'hero_image_url', p.hero_image_url,
            'hero_image_alt', p.hero_image_alt,
            'hero_image_caption', p.hero_image_caption,
            'og_image_url', p.og_image_url,
            'seo_title', p.seo_title,
            'meta_description', p.meta_description,
            'focus_keyword', p.focus_keyword,
            'canonical_url', p.canonical_url,
            'og_title', p.og_title,
            'og_description', p.og_description,
            'robots_index', p.robots_index,
            'robots_follow', p.robots_follow,
            'featured', p.featured,
            'toc_enabled', p.toc_enabled,
            'drop_cap', p.drop_cap,
            'content_width', p.content_width,
            'accent_color', p.accent_color,
            'faqs', p.faqs,
            'published_at', p.published_at,
            'created_at', p.created_at,
            'updated_at', p.updated_at
          )
          order by p.published_at desc, p.created_at desc
        )
        from public.blog_posts p
        where p.status = 'published'
          and p.published_at is not null
          and p.published_at <= now()
      ),
      '[]'::jsonb
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

comment on function private.blog_get_public_payload() is
'Private SECURITY DEFINER data accessor. Only the public invoker wrapper exposes published blog content.';
comment on function public.get_public_blog_payload() is
'Public SECURITY INVOKER wrapper returning only published blog posts and public display settings.';
