-- Secure personal blog CMS
-- Drafts remain in Supabase. Only published JSON is copied into the public static site.
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  language text not null default 'fa' check (language in ('fa','en')),
  category text not null default '',
  tags text[] not null default '{}',
  hero_image_url text,
  hero_image_alt text not null default '',
  hero_image_caption text not null default '',
  og_image_url text,
  seo_title text not null default '',
  meta_description text not null default '',
  focus_keyword text not null default '',
  canonical_url text not null default '',
  og_title text not null default '',
  og_description text not null default '',
  robots_index boolean not null default true,
  robots_follow boolean not null default true,
  featured boolean not null default false,
  toc_enabled boolean not null default true,
  drop_cap boolean not null default false,
  content_width text not null default 'reading' check (content_width in ('reading','wide')),
  accent_color text not null default '#405a42',
  faqs jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  has_unpublished_changes boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint blog_posts_faq_array check (jsonb_typeof(faqs) = 'array')
);

create index if not exists blog_posts_status_published_idx
  on public.blog_posts(status, published_at desc);
create index if not exists blog_posts_featured_idx
  on public.blog_posts(featured, published_at desc)
  where status = 'published';

create table if not exists public.blog_settings (
  id integer primary key default 1 check (id = 1),
  title text not null default 'نوشته‌ها',
  tagline text not null default 'یادداشت‌هایی درباره برند، معنا و ارتباط',
  description text not null default '',
  background_theme text not null default 'paper' check (background_theme in ('paper','white','warm')),
  accent_color text not null default '#405a42',
  card_style text not null default 'editorial' check (card_style in ('editorial','minimal','image-led')),
  posts_per_page integer not null default 9 check (posts_per_page between 3 and 24),
  show_search boolean not null default true,
  show_categories boolean not null default true,
  show_featured boolean not null default true,
  show_reading_time boolean not null default true,
  default_meta_title text not null default 'وبلاگ آریا کیانزاد',
  default_meta_description text not null default '',
  default_og_image text not null default '',
  footer_note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.blog_posts enable row level security;
alter table public.blog_settings enable row level security;

revoke all on table public.blog_posts from anon, authenticated, public;
revoke all on table public.blog_settings from anon, authenticated, public;
grant all on table public.blog_posts to service_role;
grant all on table public.blog_settings to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-media',
  'blog-media',
  true,
  8388608,
  array['image/webp','image/jpeg','image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read published blog media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'blog-media');
