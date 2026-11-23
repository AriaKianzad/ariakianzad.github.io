"use client";

import { useState } from "react";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);

  async function copyLink() {
    setCopied(false);
    setManualCopy(false);
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          return;
        } catch {
          // Fall through to the selection-based fallback below.
        }
      }

      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.setAttribute("aria-hidden", "true");
      field.style.position = "fixed";
      field.style.insetInlineStart = "0";
      field.style.top = "0";
      field.style.width = "2px";
      field.style.height = "2px";
      field.style.padding = "0";
      field.style.border = "0";
      field.style.opacity = "0.02";
      document.body.appendChild(field);
      field.focus();
      field.select();
      field.setSelectionRange(0, field.value.length);
      let success = false;
      try {
        success = document.execCommand("copy");
      } finally {
        field.remove();
      }
      if (success) setCopied(true);
      else setManualCopy(true);
    } catch {
      setManualCopy(true);
    }
  }

  return (
    <div className="blog-share-copy-wrap">
      <button className="blog-share-copy" type="button" onClick={copyLink} aria-live="polite">
        {copied ? "لینک کپی شد ✓" : manualCopy ? "انتخاب لینک برای کپی" : "کپی لینک"}
      </button>
      {manualCopy ? (
        <div className="blog-share-manual-copy" dir="rtl">
          <input
            type="text"
            readOnly
            value={url}
            aria-label="نشانی مقاله برای کپی دستی"
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
          />
          <small>کپی خودکار در این مرورگر در دسترس نبود؛ لینک انتخاب شده، Ctrl+C رو بزن.</small>
        </div>
      ) : null}
      {copied ? <span className="blog-copy-status" role="status">نشانی اصلی مقاله کپی شد.</span> : null}
    </div>
  );
}
