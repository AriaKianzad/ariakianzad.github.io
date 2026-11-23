(() => {
  "use strict";

  const normalize = (value) => String(value || "")
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .toLocaleLowerCase("fa")
    .replace(/\s+/g, " ")
    .trim();

  function bindListing(root) {
    if (!root || root.dataset.blogListingBound === "true") return;
    const list = root.querySelector("[data-blog-card-list]");
    if (!list) return;

    const cards = Array.from(list.querySelectorAll("[data-blog-post-card]"));
    const search = root.querySelector("[data-blog-search]");
    const categoryButtons = Array.from(root.querySelectorAll("[data-blog-category]"));
    const count = root.querySelector("[data-blog-result-count]");
    const clear = root.querySelector("[data-blog-clear]");
    const empty = root.querySelector("[data-blog-no-results]");
    const loadMoreWrap = root.querySelector("[data-blog-load-more-wrap]");
    const loadMore = root.querySelector("[data-blog-load-more]");
    const pageSize = Math.max(1, Number(root.dataset.pageSize) || 9);
    let activeCategory = "";
    let visibleCount = pageSize;
    let query = "";
    root.dataset.blogListingBound = "true";

    const prepared = cards.map((card) => ({
      card,
      searchText: normalize(card.dataset.searchText || ""),
      categories: (card.dataset.categorySlugs || "").split(/\s+/).filter(Boolean),
    }));

    function render() {
      const matching = prepared.filter((item) =>
        (!activeCategory || item.categories.includes(activeCategory)) &&
        (!query || item.searchText.includes(query))
      );

      let shown = 0;
      for (const item of prepared) {
        const matched = (!activeCategory || item.categories.includes(activeCategory)) &&
          (!query || item.searchText.includes(query));
        const visible = matched && shown < visibleCount;
        item.card.hidden = !visible;
        if (matched) shown += 1;
      }

      if (count) count.textContent = matching.length.toLocaleString("fa-IR") + " نوشته";
      if (empty) empty.hidden = matching.length !== 0;
      if (loadMoreWrap) loadMoreWrap.hidden = matching.length <= visibleCount;
      if (clear) clear.hidden = !query && !activeCategory;
      for (const button of categoryButtons) {
        const selected = (button.dataset.blogCategory || "") === activeCategory;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
      }
    }

    if (search) {
      search.addEventListener("input", () => {
        query = normalize(search.value);
        visibleCount = pageSize;
        render();
      });
    }

    root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const categoryButton = target?.closest("[data-blog-category]");
      if (categoryButton && root.contains(categoryButton)) {
        activeCategory = categoryButton.dataset.blogCategory || "";
        visibleCount = pageSize;
        render();
        return;
      }
      if (target?.closest("[data-blog-clear]")) {
        if (search) search.value = "";
        query = "";
        activeCategory = "";
        visibleCount = pageSize;
        render();
        if (search) search.focus({ preventScroll: true });
        return;
      }
      if (target?.closest("[data-blog-load-more]")) {
        visibleCount += pageSize;
        render();
      }
    });

    render();
  }

  function start() {
    document.querySelectorAll("[data-blog-listing]").forEach(bindListing);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
