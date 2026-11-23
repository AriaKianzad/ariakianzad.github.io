/* Progressive enhancement for the static blog archive. */
(() => {
  "use strict";
  const normalize = (value) => String(value || "")
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\\u064B-\\u065F\\u0670\\u0640]/g, "")
    .toLocaleLowerCase("fa")
    .replace(/\\s+/g, " ")
    .trim();

  document.querySelectorAll("[data-blog-listing]").forEach((widget) => {
    const cards = Array.from(widget.querySelectorAll("[data-blog-post-card]"));
    const search = widget.querySelector("[data-blog-search]");
    const filters = Array.from(widget.querySelectorAll("[data-category-filter]"));
    const results = widget.querySelector("[data-blog-results]");
    const clear = widget.querySelector("[data-clear-blog-filters]");
    const empty = widget.querySelector("[data-blog-empty]");
    const moreWrap = widget.querySelector("[data-blog-load-more]");
    const more = widget.querySelector("[data-load-more]");
    if (!cards.length) return;

    const pageSize = Math.max(1, Number(widget.dataset.pageSize) || 9);
    let activeCategory = "";
    let visibleLimit = pageSize;
    let matches = cards;
    widget.classList.add("blog-listing-enhanced");

    const render = () => {
      const needle = normalize(search?.value);
      matches = cards.filter((card) => {
        const categorySlugs = (card.dataset.categorySlugs || "").split(/\\s+/).filter(Boolean);
        const matchesCategory = !activeCategory || categorySlugs.includes(activeCategory);
        const matchesText = !needle || normalize(card.dataset.searchText).includes(needle);
        return matchesCategory && matchesText;
      });
      let shown = 0;
      for (const card of matches) {
        const visible = shown < visibleLimit;
        card.hidden = !visible;
        if (visible) shown += 1;
      }
      for (const card of cards) if (!matches.includes(card)) card.hidden = true;
      if (results) results.textContent = matches.length.toLocaleString("fa-IR") + " نوشته";
      if (empty) empty.hidden = matches.length > 0;
      if (moreWrap) moreWrap.hidden = matches.length <= shown;
      if (clear) clear.hidden = !needle && !activeCategory;
      for (const button of filters) {
        const selected = (button.dataset.categoryFilter || "") === activeCategory;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
      }
    };

    search?.addEventListener("input", () => { visibleLimit = pageSize; render(); });
    filters.forEach((button) => button.addEventListener("click", () => {
      activeCategory = button.dataset.categoryFilter || "";
      visibleLimit = pageSize;
      render();
    }));
    clear?.addEventListener("click", () => {
      if (search) search.value = "";
      activeCategory = "";
      visibleLimit = pageSize;
      render();
      search?.focus();
    });
    more?.addEventListener("click", () => { visibleLimit += pageSize; render(); });
    render();
  });
})();
