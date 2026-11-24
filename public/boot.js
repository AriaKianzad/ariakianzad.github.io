/*
 * Runs before first paint: enables enhancement-only CSS.
 * If the deferred enhancement bundle never starts, fail open after a short
 * grace period so reveal-gated content and the mobile navigation stay usable.
 */
(() => {
  const root = document.documentElement;
  root.setAttribute("data-js", "");

  window.setTimeout(() => {
    if (!root.hasAttribute("data-ui-ready")) {
      root.removeAttribute("data-js");
    }
  }, 3000);
})();
