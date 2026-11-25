-- Keep the category's stable English slug and URL while updating its visible Persian name.
update public.blog_settings
set categories = coalesce(
  (
    select jsonb_agg(
      case
        when category.item ->> 'slug' = 'culture'
          then jsonb_set(category.item, '{name}', to_jsonb('فرهنگ و رسانه'::text), true)
        else category.item
      end
      order by category.ordinality
    )
    from jsonb_array_elements(categories) with ordinality as category(item, ordinality)
  ),
  '[]'::jsonb
),
updated_at = now()
where id = 1
  and exists (
    select 1
    from jsonb_array_elements(categories) as category(item)
    where category.item ->> 'slug' = 'culture'
  );
