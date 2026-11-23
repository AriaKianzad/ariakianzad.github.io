"use client";

import { useRef, useState } from "react";

type CopyFeedback = "copied" | "manual" | null;

export function CopyLinkButton({ url }: { url: string }) {
  const [feedback, setFeedback] = useState<CopyFeedback>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const feedbackTimer = useRef<number | null>(null);

  function showFeedback(next: CopyFeedback) {
    setFeedback(next);
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
    }
    if (next !== null) {
      feedbackTimer.current = window.setTimeout(() => {
        setFeedback(null);
        feedbackTimer.current = null;
      }, 2200);
    }
  }

  async function copyLink() {
    setManualCopy(false);
    showFeedback(null);

    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        showFeedback("copied");
        return;
      } catch {
        // Continue to the legacy clipboard path when browser permission is denied.
      }
    }

    let copiedWithLegacyCommand = false;
    const field = document.createElement("textarea");
    field.value = url;
    field.setAttribute("readonly", "");
    field.setAttribute("aria-hidden", "true");
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.left = "0";
    field.style.width = "1px";
    field.style.height = "1px";
    field.style.padding = "0";
    field.style.border = "0";
    field.style.opacity = "0";
    field.style.zIndex = "-1";

    try {
      document.body.appendChild(field);
      field.focus({ preventScroll: true });
      field.select();
      field.setSelectionRange(0, field.value.length);
      copiedWithLegacyCommand = document.execCommand("copy");
    } catch {
      copiedWithLegacyCommand = false;
    } finally {
      field.remove();
    }

    if (copiedWithLegacyCommand) {
      showFeedback("copied");
      return;
    }

    setManualCopy(true);
    showFeedback("manual");
  }

  return (
    <div className="blog-share-copy-wrap">
      <button
        className="blog-share-copy"
        type="button"
        onClick={copyLink}
        aria-label="کپی کردن لینک مقاله"
      >
        کپی لینک
      </button>

      {feedback ? (
        <span
          className={"blog-copy-toast" + (feedback === "manual" ? " is-manual" : "")}
          role="status"
          aria-live="polite"
        >
          {feedback === "copied" ? "لینک کپی شد" : "کپی خودکار در دسترس نیست"}
        </span>
      ) : null}

      {manualCopy ? (
        <div className="blog-share-manual-copy" dir="rtl">
          <input
            type="text"
            readOnly
            value={url}
            aria-label="نشانی مقاله برای کپی دستی"
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
            onCopy={() => showFeedback("copied")}
          />
          <small>لینک انتخاب شده؛ برای کپی دستی Ctrl+C رو بزن.</small>
        </div>
      ) : null}
    </div>
  );
}
