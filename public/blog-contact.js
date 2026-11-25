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

  let turnstileLoaderPromise = null;

  function loadTurnstileWidget(form) {
    const widget = form.querySelector(".cf-turnstile");
    if (!widget || widget.dataset.widgetId) return;

    const render = () => {
      if (!widget.isConnected || widget.dataset.widgetId || !window.turnstile) return;
      widget.dataset.widgetId = window.turnstile.render(widget, {
        sitekey: widget.dataset.sitekey,
        action: widget.dataset.action || "blog_contact",
        theme: widget.dataset.theme || "light",
      });
    };

    if (window.turnstile && typeof window.turnstile.render === "function") {
      render();
      return;
    }

    if (!turnstileLoaderPromise) {
      turnstileLoaderPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-turnstile-loader]');
        if (existing) {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
          return;
        }

        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.turnstileLoader = "true";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    turnstileLoaderPromise.then(render).catch(() => {
      showStatus(form, "بررسی امنیتی بارگذاری نشد. لطفاً صفحه رو تازه‌سازی کنید.", "error");
    });
  }

  function resetTurnstile(form) {
    const widget = form.querySelector(".cf-turnstile");
    if (!widget || !window.turnstile || typeof window.turnstile.reset !== "function") return;
    if (widget.dataset.widgetId) window.turnstile.reset(widget.dataset.widgetId);
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

    const formData = new FormData(form);
    const turnstileWidget = form.querySelector(".cf-turnstile");
    if (turnstileWidget && !String(formData.get("cf-turnstile-response") || "").trim()) {
      showStatus(form, "لطفاً بررسی امنیتی رو کامل کنید.", "error");
      return;
    }

    const values = Object.fromEntries(formData.entries());
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
      resetTurnstile(form);
      setBusy(form, false);
    }
  }

  function bindForm(form) {
    if (form.dataset.contactBound === "true") return;
    form.dataset.contactBound = "true";
    form.noValidate = true;

    updateConditionalFields(form);
    loadTurnstileWidget(form);
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
