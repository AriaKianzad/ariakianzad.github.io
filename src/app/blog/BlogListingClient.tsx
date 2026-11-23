import Link from "next/link";
import { getPostCategorySlugs, getPrimaryCategorySlug } from "@/lib/blog-category-utils";
import type { BlogPost } from "@/lib/blog-data";

type Category = { name: string; count: number; slug: string };

function readingTime(content: string, language: "fa" | "en" = "fa") {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / (language === "fa" ? 180 : 220)));
}

function formatDate(value: string, language: "fa" | "en") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: language === "fa" ? "Asia/Tehran" : "UTC",
  }).format(date);
}

function searchIndex(post: BlogPost) {
  return [
    post.title,
    post.slug,
    post.excerpt,
    post.focus_keyword,
    ...getPostCategorySlugs(post),
    ...(post.tags || []),
  ].filter(Boolean).join(" ");
}

export function BlogPostCard({
  post,
  featured = false,
  showReadingTime = true,
  categoryName,
  initiallyHidden = false,
}: {
  post: BlogPost;
  featured?: boolean;
  showReadingTime?: boolean;
  categoryName?: string;
  initiallyHidden?: boolean;
}) {
  const dir = post.language === "fa" ? "rtl" : "ltr";
  const image = post.hero_image_url || "/og/blog/" + post.slug + ".jpg";
  const categorySlugs = getPostCategorySlugs(post);
  const primaryCategory = getPrimaryCategorySlug(post);

  return (
    <article
      className={"blog-card" + (featured ? " blog-card-featured" : "")}
      lang={post.language}
      dir={dir}
      data-blog-post-card
      data-search-text={searchIndex(post)}
      data-category-slugs={categorySlugs.join(" ")}
      hidden={initiallyHidden}
    >
      <Link className="blog-card-image" href={"/blog/" + post.slug + "/"} tabIndex={-1} aria-hidden="true">
        <img src={image} alt={post.hero_image_alt || ""} loading="lazy" decoding="async" />
        {post.featured ? <span className="blog-featured-label">منتخب</span> : null}
      </Link>
      <div className="blog-card-copy">
        <div className="blog-card-meta">
          {primaryCategory ? <span>{categoryName || primaryCategory.replace(/-/g, " ")}</span> : null}
          <time dateTime={post.published_at} className="blog-card-date">{formatDate(post.published_at, post.language)}</time>
        </div>
        <h2><Link href={"/blog/" + post.slug + "/"}>{post.title}</Link></h2>
        {post.excerpt ? <p>{post.excerpt}</p> : null}
        <div className="blog-card-bottom">
          {showReadingTime ? <span className="blog-card-reading-time">{readingTime(post.content, post.language)} دقیقه مطالعه</span> : <span />}
          <Link href={"/blog/" + post.slug + "/"} aria-label={"خواندن " + post.title}>ادامه مطلب <span aria-hidden="true">←</span></Link>
        </div>
      </div>
    </article>
  );
}

export function BlogListingClient({
  posts,
  categories,
  showSearch,
  showCategories,
  showReadingTime,
  postsPerPage,
}: {
  posts: BlogPost[];
  categories: Category[];
  showSearch: boolean;
  showCategories: boolean;
  showReadingTime: boolean;
  postsPerPage: number;
}) {
  const pageSize = Math.max(1, Math.min(24, Number(postsPerPage) || 9));
  return (
    <div className="blog-listing-tools" data-blog-listing data-page-size={pageSize}>
      <div className="blog-filter-bar">
        {showSearch ? (
          <label className="blog-search">
            <span className="sr-only">جست‌وجو در نوشته‌ها</span>
            <span aria-hidden="true">⌕</span>
            <input
              data-blog-search
              type="search"
              inputMode="search"
              autoComplete="off"
              aria-label="جست‌وجو در نوشته‌ها"
              placeholder="دنبال چه موضوعی می‌گردی؟"
            />
          </label>
        ) : <span />}
        {showCategories ? (
          <div className="blog-category-filters" aria-label="فیلتر دسته‌بندی‌ها">
            <button className="active" data-blog-category="" aria-pressed="true" type="button">همه</button>
            {categories.map((item) => (
              <button
                key={item.slug}
                data-blog-category={item.slug}
                aria-pressed="false"
                type="button"
              >
                {item.name} <small>{item.count.toLocaleString("fa-IR")}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="blog-results-line">
        <span data-blog-result-count aria-live="polite">{posts.length.toLocaleString("fa-IR")} نوشته</span>
        <button data-blog-clear type="button" hidden>پاک‌کردن فیلترها</button>
      </div>
      {posts.length ? (
        <div className="blog-card-grid" data-blog-card-list>
          {posts.map((post, index) => (
            <BlogPostCard
              key={post.id || post.slug}
              post={post}
              categoryName={categories.find((item) => item.slug === getPrimaryCategorySlug(post))?.name}
              showReadingTime={showReadingTime}
              initiallyHidden={index >= pageSize}
            />
          ))}
        </div>
      ) : (
        <div className="blog-empty" data-blog-empty>
          <span className="blog-empty-mark">۰۱</span>
          <h2>چیزی پیدا نشد.</h2>
          <p>هنوز مقاله‌ای برای نمایش وجود نداره.</p>
        </div>
      )}
      {posts.length ? (
        <div className="blog-empty" data-blog-no-results hidden>
          <span className="blog-empty-mark">۰۱</span>
          <h2>چیزی پیدا نشد.</h2>
          <p>عبارت جست‌وجو یا دسته‌بندی رو تغییر بده.</p>
        </div>
      ) : null}
      <div className="blog-load-more" data-blog-load-more-wrap hidden>
        <button data-blog-load-more type="button">نوشته‌های بیشتر <span aria-hidden="true">↓</span></button>
      </div>
    </div>
  );
}
