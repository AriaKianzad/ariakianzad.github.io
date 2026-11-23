import Link from "next/link";
import type { BlogPost } from "@/lib/blog-content";
import { formatBlogDate, readingTime } from "@/lib/blog-content";

export function BlogPostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <article className={"blog-post-card" + (featured ? " blog-post-card-featured" : "")}>
      <Link className="blog-card-image" href={"/blog/" + post.slug + "/"} aria-label={post.title}>
        {post.heroImageUrl
          ? <img src={post.heroImageUrl} alt={post.heroImageAlt || ""} loading="lazy" decoding="async" />
          : <span className="blog-card-placeholder"><b>AK</b><i>{post.category || "NOTES"}</i></span>}
      </Link>
      <div className="blog-card-body">
        <div className="blog-card-meta">
          {post.category && <span>{post.category}</span>}
          {post.publishedAt && <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt, post.language === "en" ? "en-US" : "fa-IR")}</time>}
        </div>
        <h2><Link href={"/blog/" + post.slug + "/"}>{post.title}</Link></h2>
        {post.excerpt && <p>{post.excerpt}</p>}
        <div className="blog-card-bottom">
          <span>{readingTime(post.content, post.language)} دقیقه مطالعه</span>
          <Link href={"/blog/" + post.slug + "/"} aria-label={"خواندن " + post.title}>مطالعۀ مقاله <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </article>
  );
}
