-- Persist category-specific search and social metadata in the private CMS settings row.
alter table public.blog_settings
  add column if not exists category_seo jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'blog_settings_category_seo_object_check'
  ) then
    alter table public.blog_settings
      add constraint blog_settings_category_seo_object_check
      check (jsonb_typeof(category_seo) = 'object');
  end if;
end $$;

-- The public payload may expose only this deliberately curated SEO object.
create or replace function private.blog_get_category_seo()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select coalesce(
    (select s.category_seo from public.blog_settings s where s.id = 1),
    '{}'::jsonb
  );
$function$;

revoke all on function private.blog_get_category_seo() from public;
grant execute on function private.blog_get_category_seo() to anon, authenticated;

-- Keep the existing published-snapshot boundary and add only category SEO metadata.
create or replace function public.get_public_blog_payload()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $function$
  select jsonb_set(
    private.blog_get_public_payload(),
    '{settings,category_seo}',
    private.blog_get_category_seo(),
    true
  );
$function$;

revoke all on function public.get_public_blog_payload() from public, anon, authenticated;
grant execute on function public.get_public_blog_payload() to anon, authenticated;
