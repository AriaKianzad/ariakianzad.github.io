const roots = new Set<HTMLElement>();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let observer: IntersectionObserver | null = null;
const disposers = new Map<HTMLElement, () => void>();

function loadScene(root: HTMLElement) {
  if (root.dataset.sceneLoaded === "true" || !root.isConnected) return;
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

function releaseRoot(root: HTMLElement) {
  observer?.unobserve(root);
  const dispose = disposers.get(root);
  if (dispose) {
    dispose();
    disposers.delete(root);
  }
  root.classList.remove("is-live");
  root.dataset.sceneLoaded = "";
  roots.delete(root);
}

function observeHero() {
  observer?.disconnect();
  observer = null;

  if (reducedMotion.matches || roots.size === 0) return;

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

  roots.forEach((root) => {
    if (root.dataset.sceneLoaded !== "true" && root.dataset.sceneLoaded !== "failed") {
      observer?.observe(root);
    }
  });
}

function syncRoots() {
  const currentRoots = new Set(
    document.querySelectorAll<HTMLElement>("[data-hero-visual]"),
  );

  roots.forEach((root) => {
    if (!currentRoots.has(root)) releaseRoot(root);
  });
  currentRoots.forEach((root) => {
    if (!roots.has(root)) roots.add(root);
  });
  observeHero();
}

function releaseScenes() {
  observer?.disconnect();
  observer = null;

  roots.forEach((root) => {
    const dispose = disposers.get(root);
    if (!dispose) return;
    dispose();
    disposers.delete(root);
    root.classList.remove("is-live");
    root.dataset.sceneLoaded = "";
  });
}

window.addEventListener("pagehide", releaseScenes);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) syncRoots();
});

reducedMotion.addEventListener("change", observeHero);

// The blog archive is reached through client-side navigation from article pages.
// Watch route content changes so its hero scene is initialized as well.
const mutationObserver = typeof MutationObserver === "function"
  ? new MutationObserver(syncRoots)
  : null;
mutationObserver?.observe(document.documentElement, { childList: true, subtree: true });

syncRoots();
