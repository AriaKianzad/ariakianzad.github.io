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
    }

    addEventListener(event, callback) {
      this.listeners.set(event, callback);
    }

    click() {
      this.listeners.get("click")?.();
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

// No saved choice: show the consent dialog, but no status shortcut.
{
  const page = createPage("/");
  assert.equal(page.elements.get("analytics-consent").hidden, false);
  assert.equal(page.elements.get("analytics-preferences").hidden, true);

  page.elements.get("analytics-consent-accept").click();

  assert.equal(page.stored.get("aria-google-analytics-consent-v1"), "granted");
  assert.equal(page.elements.get("analytics-consent").hidden, true);
  assert.equal(page.elements.get("analytics-preferences").hidden, true);
  assert.equal(page.scripts.length, 1, "GA script should load after consent");
}

// Returning visitor who already accepted: never show an On status control.
{
  const page = createPage("/", "granted");
  assert.equal(page.elements.get("analytics-consent").hidden, true);
  assert.equal(page.elements.get("analytics-preferences").hidden, true);
  assert.equal(page.scripts.length, 1, "GA script should load for saved consent");
  assert.ok(!page.elements.get("analytics-preferences").textContent.includes("On"));
}

// Declined visitors retain a working control, explicitly marked Off.
{
  const page = createPage("/", "denied");
  const preferences = page.elements.get("analytics-preferences");
  assert.equal(page.elements.get("analytics-consent").hidden, true);
  assert.equal(preferences.hidden, false);
  assert.equal(preferences.textContent, "Privacy settings · Off");

  preferences.click();
  assert.equal(page.elements.get("analytics-consent").hidden, false);
  assert.equal(preferences.hidden, true, "floating shortcut must hide while the dialog is open");

  page.elements.get("analytics-consent-accept").click();
  assert.equal(preferences.hidden, true, "control must disappear after acceptance");
  assert.equal(page.stored.get("aria-google-analytics-consent-v1"), "granted");
}

// Persian book landing page uses the same Off-only behaviour.
{
  const page = createPage("/Mian-e-Ma/", "denied");
  const preferences = page.elements.get("analytics-preferences");
  assert.equal(preferences.hidden, false);
  assert.equal(preferences.textContent, "تنظیمات حریم خصوصی · غیرفعال");

  preferences.click();
  page.elements.get("analytics-consent-accept").click();
  assert.equal(preferences.hidden, true, "Persian status control must disappear after acceptance");
}

// Declining from the initial dialog exposes only the Off control.
{
  const page = createPage("/");
  page.elements.get("analytics-consent-reject").click();
  const preferences = page.elements.get("analytics-preferences");
  assert.equal(preferences.hidden, false);
  assert.equal(preferences.textContent, "Privacy settings · Off");
  assert.equal(page.stored.get("aria-google-analytics-consent-v1"), "denied");
  assert.ok(page.cookieWrites.length > 0, "analytics cookies should be revoked");
}

console.log("Analytics consent behaviour passed (English and Persian; accepted and declined states).");
