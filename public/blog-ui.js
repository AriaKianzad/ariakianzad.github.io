(() => {
  "use strict";
  const input = document.getElementById("blog-search");
  const grid = document.getElementById("blog-post-grid");
  const empty = document.getElementById("blog-search-empty");
  if (!input || !grid) return;
  const cards = [...grid.querySelectorAll(".blog-post-card")];
  input.addEventListener("input", () => {
    const query = input.value.trim().toLocaleLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const match = !query || card.textContent.toLocaleLowerCase().includes(query);
      card.hidden = !match;
      if (match) visible++;
    });
    if (empty) empty.hidden = visible > 0;
  });
})();
