import {
  hero,
  perspective,
  disciplines,
  approach,
  rexoSection,
  about,
  contactSection,
} from "@/content/home";
import { site } from "@/lib/site";
import { ExtArrow, FlowArrow } from "@/components/icons";

/**
 * The single page. Every section is static server markup: no client
 * components, no hydration. Enhancement lives in public/ui.js.
 */

export default function HomePage() {
  return (
    <>
      {/* -------------------------------------------------------- hero */}
      <section className="hero shell" id="top" aria-labelledby="hero-title">
        <p className="eyebrow hero__eyebrow hero-intro i1">{hero.eyebrow}</p>
        <h1 className="hero__title" id="hero-title">
          <span className="hero__line hero-intro i2">I work on what a brand</span>
          <span className="hero__line hero-intro i3">
            needs <em className="hl">to say</em>, and why
          </span>
          <span className="hero__line hero-intro i4">
            it should <em className="hl">matter</em>.
          </span>
        </h1>
        <div className="hero__lower">
          <div className="hero__lede-col hero-intro i5">
            <p className="hero__lede">{hero.lede}</p>
            <div className="hero__ctas">
              <a className="btn btn--solid" href={hero.primaryCta.href}>
                {hero.primaryCta.label}
              </a>
              <a className="btn btn--ghost" href={hero.secondaryCta.href}>
                {hero.secondaryCta.label}
              </a>
            </div>
          </div>
          <aside className="hero__index" aria-label="The strategist's index">
            <p className="hero__index-title">Index</p>
            <ul className="hero__index-list">
              {hero.index.map((item) => (
                <li key={item.n}>
                  <span className="hero__index-n" aria-hidden="true">
                    {item.n}
                  </span>
                  <span className="hero__index-concept">{item.concept}</span>
                  <span className="hero__index-frag" aria-hidden="true">
                    {item.fragment}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
        <p className="hero__status">
          <span>{site.email}</span>
          <span>rexo.agency</span>
        </p>
      </section>

      {/* ------------------------------------------------- perspective */}
      <section className="section" id="perspective" aria-labelledby="perspective-title">
        <div className="shell">
          <div className="section-head">
            <p className="eyebrow">{perspective.eyebrow}</p>
            <span className="section-head__n" aria-hidden="true">01</span>
          </div>
          <div className="grid perspective__grid">
            <h2 className="perspective__heading col-7" id="perspective-title" data-reveal>
              {perspective.heading}
            </h2>
            <div className="perspective__body-col" data-reveal>
              <p className="perspective__body">
                {perspective.body} <span className="perspective__q">{perspective.question}</span>
              </p>
              <p className="perspective__closing">{perspective.closing}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ disciplines */}
      <section className="section" id="disciplines" aria-labelledby="disciplines-title">
        <div className="shell">
          <div className="section-head">
            <p className="eyebrow">{disciplines.eyebrow}</p>
            <span className="section-head__n" aria-hidden="true">02</span>
          </div>
          <h2 className="disciplines__heading" id="disciplines-title" data-reveal>
            {disciplines.heading}
          </h2>
          <ul className="disciplines__list">
            {disciplines.items.map((item) => (
              <li className="discipline" key={item.n} data-reveal>
                <span className="discipline__numeral" aria-hidden="true">
                  {item.n}
                </span>
                <div>
                  <h3 className="discipline__title">{item.title}</h3>
                  <p className="discipline__body">{item.body}</p>
                </div>
                <ul className="discipline__notes">
                  {item.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="disciplines__bridge">
            {disciplines.bridge}
            <FlowArrow />
          </p>
        </div>
      </section>

      {/* --------------------------------------------------- approach */}
      <section className="section" id="approach" aria-labelledby="approach-title">
        <div className="shell">
          <div className="section-head">
            <p className="eyebrow">{approach.eyebrow}</p>
            <span className="section-head__n" aria-hidden="true">03</span>
          </div>
          <h2 className="approach__heading" id="approach-title" data-reveal>
            {approach.heading}
          </h2>
          <ul className="approach__list">
            {approach.items.map((item) => (
              <li className="principle" key={item.n} data-reveal>
                <span className="principle__n" aria-hidden="true">
                  {item.n}
                </span>
                <h3 className="principle__title">{item.title}</h3>
                <p className="principle__body">{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="approach__closing">{approach.closing}</p>
        </div>
      </section>

      {/* ------------------------------------------------------- rexo */}
      <section className="rexo" id="rexo" aria-labelledby="rexo-title">
        <div className="shell">
          <div className="rexo__panel" data-reveal>
            <span className="rexo__ghost" aria-hidden="true">
              Rexo
            </span>
            <div className="rexo__head">
              <p className="eyebrow">{rexoSection.eyebrow}</p>
              <p className="rexo__meta">{rexoSection.meta}</p>
            </div>
            <h2 className="rexo__title" id="rexo-title">
              {rexoSection.heading}
            </h2>
            <div className="grid rexo__grid">
              <div className="rexo__body">
                <p>{rexoSection.body}</p>
                <p className="rexo__secondary">{rexoSection.secondary}</p>
              </div>
              <div className="rexo__diagram-col">
                <div className="rexo-flow__track" aria-hidden="true">
                  <span className="rexo-flow__dot" />
                  <span className="rexo-flow__dot is-accent" />
                  <span className="rexo-flow__dot" />
                </div>
                <div className="rexo-flow__labels">
                  {rexoSection.diagram.map((step) => (
                    <div key={step.label}>
                      <span className="label">{step.label}</span>
                      <span className="note">{step.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rexo__foot">
              <a
                className="btn btn--solid rexo__cta"
                href={rexoSection.cta.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {rexoSection.cta.label}
                <ExtArrow />
              </a>
              <span className="rexo__url">rexo.agency</span>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- about */}
      <section className="section" id="about" aria-labelledby="about-title">
        <div className="shell">
          <div className="section-head">
            <p className="eyebrow">{about.eyebrow}</p>
            <span className="section-head__n" aria-hidden="true">05</span>
          </div>
          <div className="grid about__grid">
            <div className="about__heading-col">
              <h2 className="about__heading" id="about-title" data-reveal>
                {about.heading}
              </h2>
            </div>
            <div className="about__body-col" data-reveal>
              {about.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- contact */}
      <section className="section contact" id="contact" aria-labelledby="contact-title">
        <div className="shell">
          <div className="section-head">
            <p className="eyebrow">{contactSection.eyebrow}</p>
            <span className="section-head__n" aria-hidden="true">06</span>
          </div>
          <h2 className="contact__heading" id="contact-title" data-reveal>
            {contactSection.heading}
          </h2>
          <p className="contact__body" data-reveal>
            {contactSection.body}
          </p>
          <div className="contact__action" data-reveal>
            <a className="contact__email" href={contactSection.cta.href}>
              {contactSection.email}
            </a>
            <button
              className="copy-btn"
              type="button"
              data-copy={contactSection.email}
            >
              {contactSection.copyLabel}
            </button>
            <span className="copy-status" id="copy-status" role="status" aria-live="polite" />
          </div>
        </div>
      </section>
    </>
  );
}
