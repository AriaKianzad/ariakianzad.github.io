"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const SignalScene = dynamic(() => import("./signal-scene"), {
  ssr: false,
  loading: () => null,
});

const subscribeToMotionPreference = (callback: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};

const getMotionPreference = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Conservatively render the static fallback during SSR and first hydration.
const getServerMotionPreference = () => true;

export default function HeroVisual() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    getMotionPreference,
    getServerMotionPreference,
  );

  const handleReady = useCallback(() => setSceneReady(true), []);

  useEffect(() => {
    if (reducedMotion) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
      <span className="hero-visual__coordinate">35° 41&apos; N / 51° 25&apos; E</span>
    </div>
  );
}
