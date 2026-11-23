-- Idempotent cleanup of the legacy Persian category slug.
-- Remove the obsolete Persian category slug and retain the stable English category slug.
update public.blog_posts
set
  category = 'brand-and-business',
  published_snapshot = case
    when published_snapshot is not null
      and published_snapshot->>'category' in ('برند-و-کسب‌وکار', 'برند و کسب‌وکار')
    then jsonb_set(published_snapshot, '{category}', to_jsonb('brand-and-business'::text), true)
    else published_snapshot
  end,
  has_unpublished_changes = case
    when status = 'published' then false
    else has_unpublished_changes
  end,
  updated_at = now()
where category in ('برند-و-کسب‌وکار', 'برند و کسب‌وکار')
   or published_snapshot->>'category' in ('برند-و-کسب‌وکار', 'برند و کسب‌وکار');

update public.blog_settings
set
  categories = (
    select coalesce(
      jsonb_agg(category_item order by category_item->>'slug'),
      '[]'::jsonb
    )
    from jsonb_array_elements(coalesce(categories, '[]'::jsonb)) as category_item
    where category_item->>'slug' not in ('برند-و-کسب‌وکار', 'برند و کسب‌وکار')
  ),
  category_seo = (
    (coalesce(category_seo, '{}'::jsonb) - 'برند-و-کسب‌وکار' - 'برند و کسب‌وکار')
    ||
    case
      when not (coalesce(category_seo, '{}'::jsonb) ? 'brand-and-business')
        and (
          coalesce(category_seo, '{}'::jsonb) ? 'برند-و-کسب‌وکار'
          or coalesce(category_seo, '{}'::jsonb) ? 'برند و کسب‌وکار'
        )
      then jsonb_build_object(
        'brand-and-business',
        coalesce(
          category_seo->'برند-و-کسب‌وکار',
          category_seo->'برند و کسب‌وکار',
          '{}'::jsonb
        )
      )
      else '{}'::jsonb
    end
  ),
  updated_at = now()
where id = 1;
