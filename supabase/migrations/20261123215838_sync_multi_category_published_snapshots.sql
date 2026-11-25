-- Ensure all already-published article snapshots expose the new category array.
-- Public pages read only the immutable published_snapshot, not draft table columns.
update public.blog_posts
set published_snapshot = published_snapshot || jsonb_build_object(
  'category', primary_category,
  'categories', to_jsonb(categories),
  'primary_category', primary_category
)
where published_snapshot is not null;
