"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

const SignalScene = dynamic(() => import("./signal-scene"), {
  ssr: false,
  loading: () => null,
});

export default function HeroVisual() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const handleReady = useCallback(() => setSceneReady(true), []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const root = rootRef.current;
    if (!root) return;

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "220px" },
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={rootRef}
      className={`hero-visual${sceneReady ? " is-live" : ""}`}
      aria-hidden="true"
    >
      <div className="hero-visual__fallback">
        <span className="hero-visual__fallback-ring hero-visual__fallback-ring--one" />
        <span className="hero-visual__fallback-ring hero-visual__fallback-ring--two" />
        <span className="hero-visual__fallback-core" />
        <span className="hero-visual__fallback-cross" />
      </div>

      {shouldLoad && !reducedMotion ? <SignalScene onReady={handleReady} /> : null}

      <span className="hero-visual__label hero-visual__label--top">
        <i /> SIGNAL / 001
      </span>
      <span className="hero-visual__label hero-visual__label--side">
        AUDIENCE<br />DIFFERENCE<br />MEANING
      </span>
      <span className="hero-visual__label hero-visual__label--bottom">
        FIND THE SIGNAL IN THE NOISE
      </span>
      <span className="hero-visual__coordinate">35° 41' N / 51° 25' E</span>
    </div>
  );
}
