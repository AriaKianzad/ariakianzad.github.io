import Link from "next/link";

export function BlogPagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (page: number) => page === 1 ? "/blog/" : "/blog/page/" + page + "/";
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  return (
    <nav className="blog-pagination" aria-label="صفحه‌بندی مقاله‌ها">
      {currentPage > 1 && <Link href={href(currentPage - 1)} rel="prev">← جدیدتر</Link>}
      <div>{pages.map((page) => <Link key={page} href={href(page)}
        className={page === currentPage ? "is-current" : ""}
        aria-current={page === currentPage ? "page" : undefined}>
        {new Intl.NumberFormat("fa-IR").format(page)}
      </Link>)}</div>
      {currentPage < totalPages && <Link href={href(currentPage + 1)} rel="next">قدیمی‌تر →</Link>}
    </nav>
  );
}
