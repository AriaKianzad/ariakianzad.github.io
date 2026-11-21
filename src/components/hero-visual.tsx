export default function HeroVisual() {
  return (
    <div className="hero-visual" data-hero-visual aria-hidden="true">
      <div className="hero-visual__fallback">
        <span className="hero-visual__fallback-ring hero-visual__fallback-ring--one" />
        <span className="hero-visual__fallback-ring hero-visual__fallback-ring--two" />
        <span className="hero-visual__fallback-cross" />
        <span className="hero-visual__fallback-core" />
      </div>
      <canvas className="signal-canvas" data-signal-canvas />
      <span className="hero-visual__label hero-visual__label--top">
        <i /> LIVE SIGNAL / 01
      </span>
      <span className="hero-visual__label hero-visual__label--side">
        RESEARCH<br />POSITION<br />MEANING
      </span>
      <span className="hero-visual__label hero-visual__label--bottom">
        SIGNAL / NOISE
      </span>
      <span className="hero-visual__coordinate">35°41&apos;N · 51°25&apos;E</span>
    </div>
  );
}
