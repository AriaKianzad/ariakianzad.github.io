(() => {
  "use strict";

  const feedbackTimers = new WeakMap();

  function showFeedback(wrapper, message, kind) {
    if (!wrapper) return;
    const feedback = wrapper.querySelector("[data-copy-feedback]");
    if (!feedback) return;

    const previousTimer = feedbackTimers.get(feedback);
    if (previousTimer) window.clearTimeout(previousTimer);

    feedback.textContent = message;
    feedback.classList.toggle("is-manual", kind === "manual");
    feedback.hidden = false;

    const timer = window.setTimeout(() => {
      feedback.hidden = true;
      feedbackTimers.delete(feedback);
    }, 2200);
    feedbackTimers.set(feedback, timer);
  }

  function showManualCopy(wrapper, url) {
    const panel = wrapper.querySelector("[data-copy-manual-wrap]");
    const field = wrapper.querySelector("[data-copy-manual]");
    if (!panel || !field) return;

    field.value = url;
    panel.hidden = false;
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, field.value.length);
    showFeedback(wrapper, "کپی خودکار در دسترس نیست؛ لینک رو با Ctrl+C کپی کن.", "manual");
  }

  function legacyCopy(url) {
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
      return document.execCommand("copy") === true;
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }

  async function copyUrl(url) {
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        return true;
      } catch {
        // Try the legacy command, then expose a selectable input if it is blocked.
      }
    }
    return legacyCopy(url);
  }

  document.addEventListener("click", async (event) => {
    const button = event.target && event.target.closest
      ? event.target.closest("[data-copy-link]")
      : null;
    if (!button || button.disabled) return;

    event.preventDefault();

    const wrapper = button.closest(".blog-share-copy-wrap");
    const url = button.getAttribute("data-copy-url") || window.location.href;
    if (!wrapper || !url) return;

    if (button.dataset.copyPending === "true") return;
    button.dataset.copyPending = "true";
    button.setAttribute("aria-busy", "true");

    try {
      const copied = await copyUrl(url);
      if (copied) {
        const manualPanel = wrapper.querySelector("[data-copy-manual-wrap]");
        if (manualPanel) manualPanel.hidden = true;
        showFeedback(wrapper, "لینک کپی شد", "success");
      } else {
        showManualCopy(wrapper, url);
      }
    } catch {
      showManualCopy(wrapper, url);
    } finally {
      delete button.dataset.copyPending;
      button.removeAttribute("aria-busy");
    }
  });

  document.addEventListener("copy", () => {
    const field = document.activeElement;
    if (!field || !field.matches || !field.matches("[data-copy-manual]")) return;
    const wrapper = field.closest(".blog-share-copy-wrap");
    showFeedback(wrapper, "لینک کپی شد", "success");
  });
})();
