/*
 * Enhancement layer. Every feature here degrades to a working page without
 * it: the menu falls back to a quiet link row, reveal-gated content is never
 * hidden without [data-js], and the email address is a plain mailto link.
 * No dependencies, no tracking, no network requests.
 */
(() => {
  "use strict";

  const doc = document;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------------
     Header surface: opaque once the page scrolls.
     ------------------------------------------------------------------ */
  const header = doc.querySelector("[data-header]");
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------
     Menu: a full-screen list on small screens, toggled by a labelled
     button. Escape, outside navigation, and link taps all close it.
     ------------------------------------------------------------------ */
  const nav = doc.querySelector("[data-nav]");
  const btn = doc.querySelector("[data-menu-btn]");
  const desktop = window.matchMedia("(min-width: 900px)");

  const closeMenu = () => {
    if (!nav || !btn) return;
    nav.removeAttribute("data-open");
    btn.setAttribute("aria-expanded", "false");
  };
  const openMenu = () => {
    if (!nav || !btn) return;
    nav.setAttribute("data-open", "");
    btn.setAttribute("aria-expanded", "true");
    const first = nav.querySelector(".site-nav__link");
    if (first) first.focus();
  };

  if (btn && nav) {
    btn.addEventListener("click", () => {
      if (nav.hasAttribute("data-open")) closeMenu();
      else openMenu();
    });
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.hasAttribute("data-open")) {
        closeMenu();
        btn.focus();
      }
    });
    nav.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a")) closeMenu();
    });
    const onDesktop = () => { if (desktop.matches) closeMenu(); };
    if (typeof desktop.addEventListener === "function") desktop.addEventListener("change", onDesktop);
  }

  /* ------------------------------------------------------------------
     Scroll spy: mark the nav link of the section near the viewport band.
     ------------------------------------------------------------------ */
  const links = Array.from(doc.querySelectorAll("[data-nav-link]"));
  const sectionFor = new Map();
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const hash = href.split("#")[1];
    if (hash) {
      const section = doc.getElementById(hash);
      if (section) sectionFor.set(link, section);
    }
  }
  const setActive = (id) => {
    for (const link of links) {
      link.classList.toggle(
        "is-active",
        id !== null && (link.getAttribute("href") || "").endsWith(`#${id}`),
      );
    }
  };
  if ("IntersectionObserver" in window && sectionFor.size > 0) {
    const visible = new Set();
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        let current = null;
        for (const section of sectionFor.values()) {
          if (visible.has(section.id)) { current = section.id; break; }
        }
        setActive(current);
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    for (const section of sectionFor.values()) spy.observe(section);
  }

  /* ------------------------------------------------------------------
     Reveals: content enters once, on first intersection. Under reduced
     motion (or without IntersectionObserver) everything shows at once.
     ------------------------------------------------------------------ */
  const revealables = Array.from(doc.querySelectorAll("[data-reveal]"));
  const showAll = () => {
    for (const el of revealables) el.classList.add("is-visible");
  };
  if (revealables.length > 0) {
    if (reduced.matches || !("IntersectionObserver" in window)) {
      showAll();
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
      );
      for (const el of revealables) io.observe(el);
    }
    if (typeof reduced.addEventListener === "function") {
      reduced.addEventListener("change", () => {
        if (reduced.matches) showAll();
      });
    }
  }

  /* ------------------------------------------------------------------
     Copy email: clipboard API with a textarea fallback for non-secure
     contexts. Feedback goes to a role="status" region.
     ------------------------------------------------------------------ */
  const writeClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the textarea method */
    }
    try {
      const area = doc.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      doc.body.appendChild(area);
      area.select();
      const ok = doc.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  };

  for (const button of Array.from(doc.querySelectorAll("[data-copy]"))) {
    button.addEventListener("click", async () => {
      const ok = await writeClipboard(button.getAttribute("data-copy") || "");
      button.classList.toggle("is-copied", ok);
      const status = doc.getElementById("copy-status");
      if (status) {
        status.textContent = ok
          ? "Copied to clipboard"
          : "Copy did not work; the address is written above.";
      }
      window.setTimeout(() => button.classList.remove("is-copied"), 1800);
    });
  }
})();
