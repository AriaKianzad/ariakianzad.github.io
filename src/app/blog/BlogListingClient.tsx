import Link from "next/link";
import { getPostCategorySlugs, getPrimaryCategorySlug } from "@/lib/blog-category-utils";
import { formatBlogDate, readingTime, type BlogPost } from "@/lib/blog-data";

type Category = { name: string; count: number; slug: string };

export function BlogPostCard({ post, featured = false, showReadingTime = true, categoryName, searchableTerms = [], headingLevel = "h2" }: { post: BlogPost; featured?: boolean; showReadingTime?: boolean; categoryName?: string; searchableTerms?: string[]; headingLevel?: "h2" | "h3" }) {
  const dir = post.language === "fa" ? "rtl" : "ltr";
  const image = post.hero_image_url || "/og/blog/" + post.slug + ".jpg";
  const categorySlugs = getPostCategorySlugs(post);
  const categoryLabels = [...new Set([categoryName, ...searchableTerms, ...categorySlugs.map((slug) => slug.replace(/-/g, " "))].filter(Boolean))];
  const searchable = [post.title, post.excerpt, post.focus_keyword, ...categorySlugs, ...categoryLabels, ...(post.tags || [])].filter(Boolean).join(" ");
  const minutes = readingTime(post.content, post.language).toLocaleString(post.language === "fa" ? "fa-IR" : "en-US");
  const TitleHeading = headingLevel;
  return (
    <article className={"blog-card" + (featured ? " blog-card-featured" : "")} lang={post.language} dir={dir}
      data-blog-post-card data-category-slugs={categorySlugs.join(" ")} data-search-text={searchable}>
      <Link className="blog-card-image" href={"/blog/" + post.slug + "/"}>
        <img src={image} alt={post.hero_image_alt?.trim() || "تصویر معرفی مقاله: " + post.title} loading="lazy" decoding="async" />
        {post.featured ? <span className="blog-featured-label">منتخب</span> : null}
      </Link>
      <div className="blog-card-copy">
        <div className="blog-card-meta">
          {getPrimaryCategorySlug(post) ? <span>{categoryName || getPrimaryCategorySlug(post).replace(/-/g, " ")}</span> : null}
          <time dateTime={post.published_at} dir={dir}>{formatBlogDate(post.published_at, post.language)}</time>
        </div>
        <TitleHeading><Link href={"/blog/" + post.slug + "/"}>{post.title}</Link></TitleHeading>
        {post.excerpt ? <p>{post.excerpt}</p> : null}
        <div className="blog-card-bottom">
          {showReadingTime ? <span className={"blog-reading-time " + (post.language === "fa" ? "is-fa" : "is-en")}><bdi className="blog-reading-time-number" dir="ltr">{minutes}</bdi><span className="blog-reading-time-unit" dir={post.language === "fa" ? "rtl" : "ltr"}>{post.language === "fa" ? "دقیقه مطالعه" : "min read"}</span></span> : <span />}
          <Link href={"/blog/" + post.slug + "/"} aria-label={"خواندن " + post.title}>ادامه مطلب <span aria-hidden="true">←</span></Link>
        </div>
      </div>
    </article>
  );
}

export function BlogListingClient({
  posts, categories, showSearch, showCategories, showReadingTime, postsPerPage,
}: {
  posts: BlogPost[]; categories: Category[]; showSearch: boolean; showCategories: boolean; showReadingTime: boolean; postsPerPage: number;
}) {
  return (
    <div className="blog-listing-widget" data-blog-listing data-page-size={postsPerPage}>
      <div className="blog-filter-bar">
        {showSearch ? (
          <label className="blog-search">
            <span className="sr-only">جست‌وجو در نوشته‌ها</span>
            <span aria-hidden="true">⌕</span>
            <input data-blog-search placeholder="دنبال چه موضوعی می‌گردی؟" type="search" autoComplete="off" />
          </label>
        ) : <span />}
        {showCategories ? (
          <div className="blog-category-filters" role="group" aria-label="دسته‌بندی‌ها">
            <button className="active" data-category-filter="" aria-pressed="true" type="button">همه</button>
            {categories.map((item) => (
              <button key={item.slug} data-category-filter={item.slug} aria-pressed="false" type="button">
                {item.name} <small>{item.count.toLocaleString("fa-IR")}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="blog-results-line">
        <span data-blog-results role="status" aria-live="polite">{posts.length.toLocaleString("fa-IR")} نوشته</span>
        <button data-clear-blog-filters type="button" hidden>پاک‌کردن فیلترها</button>
      </div>
      <div className="blog-card-grid" data-blog-card-grid>
        {posts.map((post) => {
          const postCategories = getPostCategorySlugs(post);
          const categoryNames = postCategories.map((slug) => categories.find((item) => item.slug === slug)?.name || slug.replace(/-/g, " "));
          return <BlogPostCard key={post.id || post.slug} post={post} categoryName={categories.find((item) => item.slug === getPrimaryCategorySlug(post))?.name} searchableTerms={categoryNames} showReadingTime={showReadingTime} headingLevel="h3" />;
        })}
      </div>
      <div className="blog-empty" data-blog-empty hidden>
        <span className="blog-empty-mark">۰۱</span>
        <h2>چیزی پیدا نشد.</h2>
        <p>عبارت جست‌وجو یا دسته‌بندی رو تغییر بده.</p>
      </div>
      <div className="blog-load-more" data-blog-load-more hidden>
        <button type="button" data-load-more>نوشته‌های بیشتر <span aria-hidden="true">↓</span></button>
      </div>
    </div>
  );
}
