const roots = Array.from(
  document.querySelectorAll<HTMLElement>("[data-hero-visual]"),
);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let observer: IntersectionObserver | null = null;
const disposers = new Map<HTMLElement, () => void>();

function loadScene(root: HTMLElement) {
  if (root.dataset.sceneLoaded === "true") return;
  root.dataset.sceneLoaded = "true";

  void import("./signal-scene")
    .then(({ initSignalScene }) => {
      // The page may have started navigating while the scene chunk was loading.
      if (document.visibilityState === "hidden" || !root.isConnected) {
        root.dataset.sceneLoaded = "";
        return;
      }

      const dispose = initSignalScene(root);
      if (dispose) disposers.set(root, dispose);
    })
    .catch(() => {
      // Keep the CSS fallback visible if the optional WebGL chunk fails.
      root.dataset.sceneLoaded = "failed";
    });
}

function releaseScenes() {
  observer?.disconnect();
  observer = null;

  for (const root of roots) {
    const dispose = disposers.get(root);
    if (!dispose) continue;

    dispose();
    disposers.delete(root);
    root.classList.remove("is-live");
    root.dataset.sceneLoaded = "";
  }
}

window.addEventListener("pagehide", releaseScenes);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) observeHero();
});

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
