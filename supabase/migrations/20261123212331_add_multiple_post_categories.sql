-- Add up to three categories per article and retain one explicit primary category.
alter table public.blog_posts
  add column if not exists categories text[] not null default '{}'::text[],
  add column if not exists primary_category text not null default '';

-- Backfill every existing article with its current category, preserving the
-- legacy category column as an alias for the selected primary category.
update public.blog_posts
set
  primary_category = coalesce(nullif(primary_category, ''), nullif(category, ''), ''),
  categories = case
    when cardinality(categories) > 0 then categories
    when nullif(category, '') is not null then array[category]
    else '{}'::text[]
  end;

update public.blog_posts
set category = primary_category
where category is distinct from primary_category;

-- The Black Friday article belongs to Culture. Keep the change scoped to
-- category metadata; the article body, slug, media and publication date stay intact.
update public.blog_posts
set
  categories = array['culture']::text[],
  primary_category = 'culture',
  category = 'culture',
  published_snapshot = case
    when published_snapshot is null then null
    else jsonb_set(
      jsonb_set(
        jsonb_set(published_snapshot, '{category}', to_jsonb('culture'::text), true),
        '{categories}', to_jsonb(array['culture']::text[]), true
      ),
      '{primary_category}', to_jsonb('culture'::text), true
    )
  end,
  has_unpublished_changes = false
where slug = 'black-friday-history';

-- Keep published snapshots in sync for all existing posts, without touching
-- article content, SEO fields, media URLs, or publication timestamps.
update public.blog_posts
set published_snapshot = case
  when published_snapshot is null then null
  else jsonb_set(
    jsonb_set(
      jsonb_set(published_snapshot, '{category}', to_jsonb(primary_category), true),
      '{categories}', to_jsonb(categories), true
    ),
    '{primary_category}', to_jsonb(primary_category), true
  )
end
where published_snapshot is not null
  and slug <> 'black-friday-history';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.blog_posts'::regclass
      and conname = 'blog_posts_categories_max_three_check'
  ) then
    alter table public.blog_posts
      add constraint blog_posts_categories_max_three_check
      check (cardinality(categories) <= 3);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.blog_posts'::regclass
      and conname = 'blog_posts_primary_category_member_check'
  ) then
    alter table public.blog_posts
      add constraint blog_posts_primary_category_member_check
      check (
        (cardinality(categories) = 0 and primary_category = '')
        or (cardinality(categories) between 1 and 3 and primary_category = any(categories))
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.blog_posts'::regclass
      and conname = 'blog_posts_category_primary_alias_check'
  ) then
    alter table public.blog_posts
      add constraint blog_posts_category_primary_alias_check
      check (category = primary_category);
  end if;
end $$;
