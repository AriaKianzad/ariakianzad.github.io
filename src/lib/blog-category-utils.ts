export type CategoryAssignedPost = {
  category?: string;
  categories?: string[];
  primary_category?: string;
};

export function getPostCategorySlugs(post: CategoryAssignedPost): string[] {
  const values = Array.isArray(post.categories) && post.categories.length
    ? post.categories
    : [post.primary_category || post.category || ""];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, 3);
}

export function getPrimaryCategorySlug(post: CategoryAssignedPost): string {
  const selected = getPostCategorySlugs(post);
  const preferred = post.primary_category || post.category || "";
  return selected.includes(preferred) ? preferred : (selected[0] || "");
}
