-- Defense in depth: browser roles stay explicitly denied by RLS.
-- The service_role used only by the authenticated Edge Function bypasses RLS.
create policy "No direct browser access to blog posts"
on public.blog_posts
for all
to anon, authenticated
using (false)
with check (false);

create policy "No direct browser access to blog settings"
on public.blog_settings
for all
to anon, authenticated
using (false)
with check (false);
