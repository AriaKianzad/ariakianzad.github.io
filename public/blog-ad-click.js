(() => {
  "use strict";
  if (window.__BLOG_AD_CLICK_TRACKER__) return;
  window.__BLOG_AD_CLICK_TRACKER__ = true;

  const selector = "a[data-ad-click]";

  function findBannerLink(event) {
    if (typeof event.composedPath === "function") {
      for (const node of event.composedPath()) {
        if (node instanceof Element && node.matches(selector)) return node;
      }
    }

    return event.target instanceof Element
      ? event.target.closest(selector)
      : null;
  }

  function trackBannerClick(event) {
    const link = findBannerLink(event);
    if (!link) return;

    const bannerId = link.getAttribute("data-ad-click") || "";
    if (!/^banner-[1-9][0-9]*$/.test(bannerId)) return;

    const config = window.MIAN_E_MA_DASHBOARD_CONFIG || {};
    if (typeof config.supabaseUrl !== "string") {
      console.warn("Blog ad click tracking is missing its Supabase URL.");
      return;
    }

    const endpoint = config.supabaseUrl.replace(/\/+$/, "") + "/functions/v1/blog-ad-click";
    const payload = JSON.stringify({ banner_id: bannerId });

    // sendBeacon uses a CORS-safelisted text/plain body. That avoids the OPTIONS
    // preflight that can be cancelled when a banner click immediately navigates away.
    if (typeof navigator.sendBeacon === "function") {
      try {
        const queued = navigator.sendBeacon(
          endpoint,
          new Blob([payload], { type: "text/plain;charset=UTF-8" }),
        );
        if (queued) return;
      } catch (error) {
        console.warn("Blog ad click beacon could not be queued; falling back to fetch.", error);
      }
    }

    // text/plain is a CORS-safelisted content type; do not add the apikey header.
    // keepalive lets the small request finish after the browser follows the banner link.
    fetch(endpoint, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: payload,
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
    }).then((response) => {
      if (!response.ok) {
        console.warn("Blog ad click tracking returned HTTP " + response.status + ".");
      }
    }).catch((error) => {
      console.warn("Blog ad click tracking request failed.", error);
    });
  }

  // Register before interactive banner links are parsed.
  document.addEventListener("click", trackBannerClick, { capture: true, passive: true });
})();
