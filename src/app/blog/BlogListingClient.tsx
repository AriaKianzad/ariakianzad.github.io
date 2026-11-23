"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BlogPost } from "@/lib/blog-data";

type Category = { name: string; count: number; slug: string };

function readingTime(content: string, language: "fa" | "en" = "fa") {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / (language === "fa" ? 180 : 220)));
}

function formatDate(value: string, language: "fa" | "en") {
  return new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: language === "fa" ? "Asia/Tehran" : "UTC",
  }).format(new Date(value));
}

export function BlogPostCard({ post, featured = false, showReadingTime = true, categoryName }: { post: BlogPost; featured?: boolean; showReadingTime?: boolean; categoryName?: string }) {
  const dir = post.language === "fa" ? "rtl" : "ltr";
  const image = post.hero_image_url || "/og/blog/" + post.slug + ".jpg";
  return (
    <article className={"blog-card" + (featured ? " blog-card-featured" : "")} lang={post.language} dir={dir}>
      <Link className="blog-card-image" href={"/blog/" + post.slug + "/"} tabIndex={-1} aria-hidden="true">
        <img src={image} alt={post.hero_image_alt || ""} loading="lazy" decoding="async" />
        {post.featured ? <span className="blog-featured-label">منتخب</span> : null}
      </Link>
      <div className="blog-card-copy">
        <div className="blog-card-meta">
          {post.category ? <span>{categoryName || post.category}</span> : null}
          <time dateTime={post.published_at}>{formatDate(post.published_at, post.language)}</time>
        </div>
        <h2><Link href={"/blog/" + post.slug + "/"}>{post.title}</Link></h2>
        {post.excerpt ? <p>{post.excerpt}</p> : null}
        <div className="blog-card-bottom">
          {showReadingTime ? <span>{readingTime(post.content, post.language)} دقیقه مطالعه</span> : <span /> }
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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [visibleCount, setVisibleCount] = useState(postsPerPage);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return posts.filter((post) => {
      const matchesCategory = !category || post.category === category;
      const content = [post.title, post.excerpt, post.category, categories.find((item)=>item.slug===post.category)?.name||"", post.focus_keyword, ...(post.tags || [])].join(" ").toLocaleLowerCase();
      return matchesCategory && (!needle || content.includes(needle));
    });
  }, [posts, query, category, categories]);
  const visible = filtered.slice(0, visibleCount);

  function changeCategory(value: string) {
    setCategory(value);
    setVisibleCount(postsPerPage);
  }

  return (
    <>
      <div className="blog-filter-bar">
        {showSearch ? (
          <label className="blog-search">
            <span className="sr-only">جست‌وجو در نوشته‌ها</span>
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(postsPerPage); }}
              placeholder="دنبال چه موضوعی می‌گردی؟" type="search" />
          </label>
        ) : <span />}
        {showCategories ? (
          <div className="blog-category-filters" aria-label="دسته‌بندی‌ها">
            <button className={!category ? "active" : ""} onClick={() => changeCategory("")} type="button">همه</button>
            {categories.map((item) => (
              <button key={item.slug} className={category === item.name ? "active" : ""}
                onClick={() => changeCategory(item.name)} type="button">
                {item.name} <small>{item.count}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="blog-results-line">
        <span>{filtered.length.toLocaleString("fa-IR")} نوشته</span>
        {query || category ? <button type="button" onClick={() => { setQuery(""); changeCategory(""); }}>پاک‌کردن فیلترها</button> : null}
      </div>
      {visible.length ? (
        <div className="blog-card-grid">
          {visible.map((post) => <BlogPostCard key={post.id || post.slug} post={post} categoryName={categories.find((item)=>item.slug===post.category)?.name} showReadingTime={showReadingTime} />)}
        </div>
      ) : (
        <div className="blog-empty">
          <span className="blog-empty-mark">۰۱</span>
          <h2>چیزی پیدا نشد.</h2>
          <p>عبارت جست‌وجو یا دسته‌بندی رو تغییر بده.</p>
        </div>
      )}
      {filtered.length > visible.length ? (
        <div className="blog-load-more">
          <button type="button" onClick={() => setVisibleCount((count) => count + postsPerPage)}>
            نوشته‌های بیشتر <span aria-hidden="true">↓</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
