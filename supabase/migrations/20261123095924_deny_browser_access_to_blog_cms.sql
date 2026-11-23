-- Browser clients must never query or mutate the CMS tables directly.
-- Admin operations go through the authenticated blog-admin Edge Function.
drop policy if exists "Public can read published blog posts" on public.blog_posts;
drop policy if exists "Public can read blog settings" on public.blog_settings;

drop policy if exists "No direct browser access to blog posts" on public.blog_posts;
create policy "No direct browser access to blog posts"
on public.blog_posts for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "No direct browser access to blog settings" on public.blog_settings;
create policy "No direct browser access to blog settings"
on public.blog_settings for all
to anon, authenticated
using (false)
with check (false);

revoke all on table public.blog_posts from anon, authenticated;
revoke all on table public.blog_settings from anon, authenticated;
