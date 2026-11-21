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

// First visit: analytics stays unloaded until the user accepts.
{
  const page = createPage("/");
  assert.equal(get(page, "analytics-consent").hidden, false);
  assert.equal(get(page, "analytics-preferences").hidden, true);
  assert.equal(page.scripts.length, 0);

  accept(page);

  assert.equal(page.stored.get("aria-google-analytics-consent-v1"), "granted");
  assert.equal(get(page, "analytics-consent").hidden, true);
  assert.equal(get(page, "analytics-preferences").hidden, false);
  assert.equal(get(page, "analytics-preferences").textContent, "Privacy settings · On");
  assert.equal(page.scripts.length, 1, "GA script should load only after consent");
  assert.equal(page.scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-0CKL90M5R2");

  // Accepted visitors can reopen settings and withdraw consent.
  openPreferences(page);
  assert.equal(get(page, "analytics-consent").hidden, false);
  assert.equal(get(page, "analytics-preferences").hidden, true);
  reject(page);

  assert.equal(page.stored.get("aria-google-analytics-consent-v1"), "denied");
  assert.equal(get(page, "analytics-preferences").textContent, "Privacy settings · Off");
  assert.equal(get(page, "analytics-preferences").hidden, false);
  assert.ok(page.cookieWrites.some((value) => value.startsWith("_ga=")), "withdrawal should expire GA cookies");
  assert.ok(page.window.dataLayer.some((args) => args[0] === "consent" && args[1] === "update" && args[2].analytics_storage === "denied"),
    "withdrawal should update Google consent state");
}

// Returning visitor who accepted previously: show the On control immediately.
{
  const page = createPage("/", "granted");
  assert.equal(get(page, "analytics-consent").hidden, true);
  assert.equal(get(page, "analytics-preferences").hidden, false);
  assert.equal(get(page, "analytics-preferences").textContent, "Privacy settings · On");
  assert.equal(page.scripts.length, 1, "GA script should load for saved consent");

  openPreferences(page);
  reject(page);
  assert.equal(get(page, "analytics-preferences").textContent, "Privacy settings · Off");
  assert.equal(get(page, "analytics-consent").hidden, true);
}

// Returning visitor who declined previously: show the Off control and allow later acceptance.
{
  const page = createPage("/", "denied");
  assert.equal(get(page, "analytics-consent").hidden, true);
  assert.equal(get(page, "analytics-preferences").hidden, false);
  assert.equal(get(page, "analytics-preferences").textContent, "Privacy settings · Off");
  assert.equal(page.scripts.length, 0);

  openPreferences(page);
  accept(page);
  assert.equal(get(page, "analytics-preferences").textContent, "Privacy settings · On");
  assert.equal(page.scripts.length, 1);
}

// The Persian book page exposes the same persistent control and translated state.
{
  const page = createPage("/Mian-e-Ma/", "granted");
  assert.equal(get(page, "analytics-preferences").hidden, false);
  assert.equal(get(page, "analytics-preferences").textContent, "تنظیمات حریم خصوصی · فعال");
  assert.equal(page.scripts.length, 1);

  openPreferences(page);
  reject(page);
  assert.equal(get(page, "analytics-preferences").textContent, "تنظیمات حریم خصوصی · غیرفعال");
  assert.equal(get(page, "analytics-preferences").hidden, false);
}

// Declining from the initial dialog exposes the Off control and does not load GA.
{
  const page = createPage("/");
  reject(page);
  assert.equal(get(page, "analytics-preferences").hidden, false);
  assert.equal(get(page, "analytics-preferences").textContent, "Privacy settings · Off");
  assert.equal(page.stored.get("aria-google-analytics-consent-v1"), "denied");
  assert.equal(page.scripts.length, 0);
}

console.log("Analytics consent tests passed: consent is opt-in, the On/Off settings control persists, and users can withdraw or grant consent later.");
