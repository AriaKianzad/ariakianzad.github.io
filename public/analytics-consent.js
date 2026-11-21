/*
 * Google Analytics 4 consent-aware loader.
 * The Google tag is not requested until the visitor explicitly accepts.
 */
(() => {
  "use strict";

  const measurementId = "G-0CKL90M5R2";
  const storageKey = "aria-google-analytics-consent-v1";
  const panel = document.getElementById("analytics-consent");
  const preferences = document.getElementById("analytics-preferences");
  const title = document.getElementById("analytics-consent-title");
  const description = document.getElementById("analytics-consent-description");
  const accept = document.getElementById("analytics-consent-accept");
  const reject = document.getElementById("analytics-consent-reject");

  if (!panel || !preferences || !title || !description || !accept || !reject) return;

  const persian = window.location.pathname.startsWith("/Mian-e-Ma/");
  const copy = persian
    ? {
        title: "تنظیمات آمار بازدید",
        description:
          "برای شناخت بهتر بازدیدهای سایت از Google Analytics استفاده می‌کنیم. با پذیرش، داده‌های آماری بازدید و تعامل شما ثبت می‌شن.",
        accept: "پذیرش آمارگیری",
        reject: "موافقت نمی‌کنم",
        settings: "تنظیمات حریم خصوصی",
        on: "فعال",
        off: "غیرفعال",
      }
    : {
        title: "Analytics preferences",
        description:
          "We use Google Analytics to understand site traffic and improve the experience. Allow analytics to share usage data with Google.",
        accept: "Allow analytics",
        reject: "Decline",
        settings: "Privacy settings",
        on: "On",
        off: "Off",
      };

  title.textContent = copy.title;
  description.textContent = copy.description;
  accept.textContent = copy.accept;
  reject.textContent = copy.reject;

  function getSavedChoice() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === "granted" || saved === "denied" ? saved : null;
    } catch {
      return null;
    }
  }

  function updatePreferencesLabel(choice) {
    preferences.textContent = copy.settings + " · " + (choice === "granted" ? copy.on : copy.off);
  }

  function loadGoogleAnalytics() {
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", measurementId);
    }

    const selector = 'script[data-google-analytics="' + measurementId + '"]';
    if (!document.querySelector(selector)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
      script.dataset.googleAnalytics = measurementId;
      script.onerror = () => {
        console.warn("Google Analytics could not be loaded.");
      };
      document.head.appendChild(script);
    }
  }

  function revokeGoogleAnalytics() {
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", { analytics_storage: "denied" });
    }

    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (
        name === "_ga" ||
        name.startsWith("_ga_") ||
        name === "_gid" ||
        name.startsWith("_gat")
      ) {
        document.cookie = name + "=; Max-Age=0; path=/; SameSite=Lax";
      }
    });
  }

  function saveChoice(choice) {
    try {
      window.localStorage.setItem(storageKey, choice);
    } catch {
      // The choice remains active for this page view if storage is blocked.
    }

    panel.hidden = true;
    preferences.hidden = false;
    updatePreferencesLabel(choice);

    if (choice === "granted") {
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", { analytics_storage: "granted" });
      } else {
        loadGoogleAnalytics();
      }
    } else {
      revokeGoogleAnalytics();
    }
  }

  accept.addEventListener("click", () => saveChoice("granted"));
  reject.addEventListener("click", () => saveChoice("denied"));
  preferences.addEventListener("click", () => {
    panel.hidden = false;
  });

  const savedChoice = getSavedChoice();
  if (savedChoice === "granted") {
    updatePreferencesLabel(savedChoice);
    preferences.hidden = false;
    loadGoogleAnalytics();
  } else if (savedChoice === "denied") {
    updatePreferencesLabel(savedChoice);
    preferences.hidden = false;
  } else {
    panel.hidden = false;
    preferences.hidden = true;
  }
})();
