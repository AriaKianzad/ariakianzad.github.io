-- Optional per-article square banner; disabled and empty by default.
alter table public.blog_posts
  add column if not exists ad_banner_enabled boolean not null default false,
  add column if not exists ad_banner_image_url text not null default '',
  add column if not exists ad_banner_alt text not null default '',
  add column if not exists ad_banner_link_url text not null default '';

alter table public.blog_posts
  add constraint blog_posts_ad_banner_enabled_requires_content
  check (
    not ad_banner_enabled
    or (length(btrim(ad_banner_image_url)) > 0 and length(btrim(ad_banner_alt)) > 0)
  ),
  add constraint blog_posts_ad_banner_link_must_be_https
  check (ad_banner_link_url = '' or ad_banner_link_url ~ '^https://');
