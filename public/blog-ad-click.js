(() => {
  "use strict";
  if (window.__BLOG_AD_CLICK_TRACKER__) return;
  window.__BLOG_AD_CLICK_TRACKER__ = true;

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a[data-ad-click]");
    if (!link || event.defaultPrevented || (event.button !== 0)) return;

    const bannerId = link.getAttribute("data-ad-click") || "";
    if (!/^banner-[1-8]$/.test(bannerId)) return;

    const config = window.MIAN_E_MA_DASHBOARD_CONFIG || {};
    if (typeof config.supabaseUrl !== "string" || typeof config.supabaseAnonKey !== "string") return;

    fetch(config.supabaseUrl.replace(/\/+$/, "") + "/functions/v1/blog-ad-click", {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ banner_id: bannerId }),
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {
      // Tracking is deliberately non-blocking; the destination link must always work.
    });
  }, true);
})();
