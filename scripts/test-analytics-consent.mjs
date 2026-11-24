import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/analytics-consent.js", import.meta.url), "utf8");

function createPage(pathname, initialChoice = null) {
  class Element {
    constructor(id) {
      this.id = id;
      this.hidden = true;
      this.textContent = "";
      this.listeners = new Map();
      this.focused = false;
    }

    addEventListener(event, callback) {
      this.listeners.set(event, callback);
    }

    click() {
      this.listeners.get("click")?.();
    }

    focus() {
      this.focused = true;
    }
  }

  const ids = [
    "analytics-consent",
    "analytics-preferences",
    "analytics-consent-title",
    "analytics-consent-description",
    "analytics-consent-accept",
    "analytics-consent-reject",
  ];
  const elements = new Map(ids.map((id) => [id, new Element(id)]));
  const scripts = [];
  const stored = new Map();
  const cookieWrites = [];
  let cookieValue = "_ga=sample; _gid=sample";

  if (initialChoice) stored.set("aria-google-analytics-consent-v1", initialChoice);

  const window = {
    location: { pathname },
    localStorage: {
      getItem(key) {
        return stored.get(key) ?? null;
      },
      setItem(key, value) {
        stored.set(key, value);
      },
    },
  };

  const document = {
    getElementById(id) {
      return elements.get(id) ?? null;
    },
    querySelector(selector) {
      return scripts.find((script) => selector.includes(script.dataset.googleAnalytics)) ?? null;
    },
    createElement(tag) {
      assert.equal(tag, "script");
      return { dataset: {}, async: false, src: "", onerror: null };
    },
    head: {
      appendChild(script) {
        scripts.push(script);
      },
    },
  };

  Object.defineProperty(document, "cookie", {
    get() {
      return cookieValue;
    },
    set(value) {
      cookieWrites.push(value);
      const name = value.split("=")[0];
      cookieValue = cookieValue
        .split(";")
        .filter((entry) => entry.trim().split("=")[0] !== name)
        .join(";");
    },
  });

  vm.runInNewContext(source, { window, document, console, Date });

  return { window, document, elements, scripts, stored, cookieWrites };
}

const get = (page, id) => page.elements.get(id);
const accept = (page) => get(page, "analytics-consent-accept").click();
const reject = (page) => get(page, "analytics-consent-reject").click();
const openPreferences = (page) => get(page, "analytics-preferences").click();

// First visit: the consent panel is visible; the floating control stays hidden.
{
  const page = createPage("/");
  assert.equal(get(page, "analytics-consent").hidden, false);
  assert.equal(get(page, "analytics-preferences").hidden, true);
  assert.equal(page.scripts.length, 0);

  accept(page);

  assert.equal(page.stored.get("aria-google-analytics-consent-v1"), "granted");
  assert.equal(get(page, "analytics-consent").hidden, true);
  assert.equal(get(page, "analytics-preferences").hidden, true, "accepted visitors must not see the floating preferences button");
  assert.equal(page.scripts.length, 1, "GA script should load only after consent");
  assert.equal(page.scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-0CKL90M5R2");
}

// Returning visitor who accepted previously: keep the button hidden.
{
  const page = createPage("/", "granted");
  assert.equal(get(page, "analytics-consent").hidden, true);
  assert.equal(get(page, "analytics-preferences").hidden, true);
  assert.equal(page.scripts.length, 1, "GA script should load for saved consent");
}

// A declined choice is not approval, so the visitor can still reopen preferences.
{
  const page = createPage("/", "denied");
  assert.equal(get(page, "analytics-consent").hidden, true);
  assert.equal(get(page, "analytics-preferences").hidden, false);
  assert.equal(get(page, "analytics-preferences").textContent, "Privacy settings · Off");
  assert.equal(page.scripts.length, 0);

  openPreferences(page);
  assert.equal(get(page, "analytics-consent").hidden, false);
  assert.equal(get(page, "analytics-preferences").hidden, true);
  accept(page);
  assert.equal(get(page, "analytics-consent").hidden, true);
  assert.equal(get(page, "analytics-preferences").hidden, true);
  assert.equal(page.scripts.length, 1);
}

// The Persian book page follows the same accepted/declined visibility rule.
{
  const accepted = createPage("/Mian-e-Ma/", "granted");
  assert.equal(get(accepted, "analytics-preferences").hidden, true);
  assert.equal(accepted.scripts.length, 1);

  const declined = createPage("/Mian-e-Ma/", "denied");
  assert.equal(get(declined, "analytics-preferences").hidden, false);
  assert.equal(get(declined, "analytics-preferences").textContent, "تنظیمات حریم خصوصی · غیرفعال");
  assert.equal(declined.scripts.length, 0);
}

// The floating control and the consent panel are always absent on every blog route.
{
  const blogPaths = [
    "/blog/",
    "/blog/black-friday-history/",
    "/blog/category/brand-and-business/",
    "/blog/contact/",
  ];
  for (const pathname of blogPaths) {
    for (const choice of [null, "granted", "denied"]) {
      const page = createPage(pathname, choice);
      assert.equal(get(page, "analytics-consent").hidden, true, pathname + " must not show the consent panel");
      assert.equal(get(page, "analytics-preferences").hidden, true, pathname + " must never show the floating preferences control");
      assert.equal(page.scripts.length, choice === "granted" ? 1 : 0, "blog analytics must still respect the saved consent state");
      openPreferences(page);
      assert.equal(get(page, "analytics-consent").hidden, true, "the blog preferences control must not open the panel");
      assert.equal(get(page, "analytics-preferences").hidden, true);
    }
  }
}

// Declining the initial dialog exposes the button, but never loads GA.
{
  const page = createPage("/");
  reject(page);
  assert.equal(get(page, "analytics-consent").hidden, true);
  assert.equal(get(page, "analytics-preferences").hidden, false);
  assert.equal(get(page, "analytics-preferences").textContent, "Privacy settings · Off");
  assert.equal(page.stored.get("aria-google-analytics-consent-v1"), "denied");
  assert.equal(page.scripts.length, 0);
}

console.log("Analytics consent tests passed: the floating control stays hidden after acceptance and on all blog routes.");
