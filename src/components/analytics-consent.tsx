"use client";

import { useEffect, useState } from "react";

const MEASUREMENT_ID = "G-0CKL90M5R2";
const CONSENT_KEY = "aria-google-analytics-consent-v1";

type ConsentChoice = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function loadGoogleAnalytics() {
  if (typeof window === "undefined") return;

  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID);
  }

  const selector = `script[data-google-analytics="${MEASUREMENT_ID}"]`;
  if (!document.querySelector(selector)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    script.dataset.googleAnalytics = MEASUREMENT_ID;
    document.head.appendChild(script);
  }
}

function revokeGoogleAnalytics() {
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", { analytics_storage: "denied" });
  }

  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (
      name === "_ga" ||
      name?.startsWith("_ga_") ||
      name === "_gid" ||
      name?.startsWith("_gat")
    ) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    }
  });
}

export function AnalyticsConsent() {
  const [ready, setReady] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [isPersian, setIsPersian] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice | null>(null);

  useEffect(() => {
    setIsPersian(window.location.pathname.startsWith("/Mian-e-Ma/"));

    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(CONSENT_KEY);
    } catch {
      saved = null;
    }

    if (saved === "granted") {
      setChoice("granted");
      loadGoogleAnalytics();
    } else if (saved === "denied") {
      setChoice("denied");
    } else {
      setShowPanel(true);
    }
    setReady(true);
  }, []);

  function chooseConsent(nextChoice: ConsentChoice) {
    try {
      window.localStorage.setItem(CONSENT_KEY, nextChoice);
    } catch {
      // Keep the choice for this page view even when browser storage is blocked.
    }

    setChoice(nextChoice);
    setShowPanel(false);

    if (nextChoice === "granted") {
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", { analytics_storage: "granted" });
      } else {
        loadGoogleAnalytics();
      }
    } else {
      revokeGoogleAnalytics();
    }
  }

  if (!ready) return null;

  const copy = isPersian
    ? {
        title: "تنظیمات آمار بازدید",
        description:
          "برای شناخت بهتر بازدیدهای سایت از Google Analytics استفاده می‌کنیم. با پذیرش، داده‌های آماری بازدید و تعامل شما ثبت می‌شن.",
        accept: "پذیرش آمارگیری",
        reject: "موافقت نمی‌کنم",
        settings: "تنظیمات حریم خصوصی",
      }
    : {
        title: "Analytics preferences",
        description:
          "We use Google Analytics to understand site traffic and improve the experience. Allow analytics to share usage data with Google.",
        accept: "Allow analytics",
        reject: "Decline",
        settings: "Privacy settings",
      };

  return (
    <>
      {showPanel ? (
        <section className="analytics-consent" role="dialog" aria-label={copy.title}>
          <div className="analytics-consent__copy">
            <strong>{copy.title}</strong>
            <p>{copy.description}</p>
          </div>
          <div className="analytics-consent__actions">
            <button
              className="analytics-consent__accept"
              type="button"
              onClick={() => chooseConsent("granted")}
            >
              {copy.accept}
            </button>
            <button
              className="analytics-consent__reject"
              type="button"
              onClick={() => chooseConsent("denied")}
            >
              {copy.reject}
            </button>
          </div>
        </section>
      ) : (
        <button
          className="analytics-preferences"
          type="button"
          onClick={() => setShowPanel(true)}
        >
          {copy.settings}
          {choice === "granted" ? " · On" : " · Off"}
        </button>
      )}
    </>
  );
}
