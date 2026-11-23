export function CopyLinkButton({ url }: { url: string }) {
  return (
    <div className="blog-share-copy-wrap">
      <button
        className="blog-share-copy"
        type="button"
        data-copy-link
        data-copy-url={url}
        aria-label="کپی کردن لینک مقاله"
      >
        کپی لینک
      </button>
      <span
        className="blog-copy-toast"
        data-copy-feedback
        role="status"
        aria-live="polite"
        hidden
      />
      <div className="blog-share-manual-copy" data-copy-manual-wrap dir="rtl" hidden>
        <input
          type="text"
          readOnly
          data-copy-manual
          aria-label="نشانی مقاله برای کپی دستی"
        />
        <small data-copy-hint>لینک انتخاب شده؛ برای کپی دستی Ctrl+C رو بزن.</small>
      </div>
    </div>
  );
}
