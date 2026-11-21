const roots = Array.from(
  document.querySelectorAll<HTMLElement>("[data-hero-visual]"),
);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let observer: IntersectionObserver | null = null;

function loadScene(root: HTMLElement) {
  if (root.dataset.sceneLoaded === "true") return;
  root.dataset.sceneLoaded = "true";

  void import("./signal-scene")
    .then(({ initSignalScene }) => initSignalScene(root))
    .catch(() => {
      // Keep the CSS fallback visible if the optional WebGL chunk fails.
      root.dataset.sceneLoaded = "failed";
    });
}

function observeHero() {
  observer?.disconnect();
  observer = null;

  if (reducedMotion.matches || roots.length === 0) return;

  if (typeof IntersectionObserver === "undefined") {
    roots.forEach(loadScene);
    return;
  }

  observer = new IntersectionObserver((entries, currentObserver) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      currentObserver.unobserve(entry.target);
      loadScene(entry.target as HTMLElement);
    }
  }, { rootMargin: "220px 0px" });

  roots
    .filter((root) => root.dataset.sceneLoaded !== "true" && root.dataset.sceneLoaded !== "failed")
    .forEach((root) => observer?.observe(root));
}

reducedMotion.addEventListener("change", observeHero);
observeHero();
