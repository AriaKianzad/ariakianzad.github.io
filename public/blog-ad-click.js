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
    if (typeof config.supabaseUrl !== "string" || typeof config.supabaseAnonKey !== "string") {
      console.warn("Blog ad click tracking is missing its public Supabase configuration.");
      return;
    }

    fetch(config.supabaseUrl.replace(/\/+$/, "") + "/functions/v1/blog-ad-click", {
      method: "POST",
      mode: "cors",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ banner_id: bannerId }),
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
