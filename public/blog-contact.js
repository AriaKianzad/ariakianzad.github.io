(() => {
  "use strict";

  const ENDPOINT = "https://bkohdqwecnvbmeaiuyyx.supabase.co/functions/v1/blog-contact";
  const PUBLIC_KEY = "sb_publishable_FZBK8LPOyf2nAtS8jhchUw_3SVXvo6h";
  const FORM_SELECTOR = "[data-blog-contact-form]";

  function showStatus(form, message, kind) {
    const status = form.querySelector("[data-contact-status]");
    if (!status) return;

    status.textContent = message;
    status.hidden = false;
    status.classList.remove("success", "error");
    status.classList.add(kind);
    status.setAttribute("role", kind === "error" ? "alert" : "status");
    status.setAttribute("aria-live", "polite");
  }

  function updateConditionalFields(form) {
    const requestType = form.querySelector('[name="requestType"]')?.value || "general";

    form.querySelectorAll("[data-show-for]").forEach((container) => {
      const allowedTypes = (container.getAttribute("data-show-for") || "").split(/\s+/);
      const shouldShow = allowedTypes.includes(requestType);
      container.hidden = !shouldShow;
      container.setAttribute("aria-hidden", shouldShow ? "false" : "true");

      container.querySelectorAll("input, select, textarea").forEach((field) => {
        field.disabled = !shouldShow;
      });
    });
  }

  function setBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');
    const label = form.querySelector("[data-submit-label]");
    if (!button || !label) return;

    button.disabled = busy;
    button.setAttribute("aria-busy", busy ? "true" : "false");
    label.textContent = busy ? "در حال ارسال..." : "ارسال درخواست";
  }

  function newSubmissionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function submitForm(form, event) {
    event.preventDefault();

    const firstInvalid = form.querySelector(":invalid");
    if (!form.checkValidity()) {
      showStatus(
        form,
        "لطفاً نام، ایمیل معتبر و توضیحات درخواست رو کامل کنید. توضیحات باید حداقل ۲۰ کاراکتر باشه.",
        "error",
      );
      if (firstInvalid && typeof firstInvalid.focus === "function") {
        firstInvalid.focus();
      }
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if (button && button.disabled) return;

    const values = Object.fromEntries(new FormData(form).entries());
    values.submissionId = newSubmissionId();

    setBusy(form, true);
    const status = form.querySelector("[data-contact-status]");
    if (status) status.hidden = true;

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          apikey: PUBLIC_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "ارسال پیام ناموفق بود. لطفاً دوباره تلاش کنید.",
        );
      }

      form.reset();
      updateConditionalFields(form);
      showStatus(
        form,
        "پیامتون با موفقیت ارسال شد. بعد از بررسی، از طریق ایمیل با شما در ارتباط می‌مونم.",
        "success",
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "ارتباط با سرویس ارسال پیام برقرار نشد. لطفاً کمی بعد دوباره تلاش کنید.";
      showStatus(form, message, "error");
    } finally {
      setBusy(form, false);
    }
  }

  function bindForm(form) {
    if (form.dataset.contactBound === "true") return;
    form.dataset.contactBound = "true";
    form.noValidate = true;

    updateConditionalFields(form);
    form.addEventListener("submit", (event) => {
      void submitForm(form, event);
    });

    const requestType = form.querySelector('[name="requestType"]');
    requestType?.addEventListener("change", () => updateConditionalFields(form));
  }

  function scan(root) {
    if (root instanceof Element && root.matches(FORM_SELECTOR)) {
      bindForm(root);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll(FORM_SELECTOR).forEach(bindForm);
    }
  }

  function start() {
    scan(document);
    if (typeof MutationObserver === "function") {
      const observer = new MutationObserver((records) => {
        records.forEach((record) => {
          record.addedNodes.forEach((node) => {
            if (node instanceof Element) scan(node);
          });
        });
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
