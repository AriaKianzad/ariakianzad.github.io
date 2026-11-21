import {
  hero,
  manifesto,
  expertise,
  method,
  rexoSection,
  notes,
  about,
  contactSection,
} from "@/content/home";
import HeroVisual from "@/components/hero-visual";
import { ExtArrow, FlowArrow } from "@/components/icons";

export default function HomePage() {
  return (
    <>
      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="shell hero__shell">
          <div className="hero__grid">
            <div className="hero__copy">
              <p className="eyebrow hero__eyebrow hero-intro hero-intro--one">
                {hero.eyebrow}
              </p>
              <h1 className="hero__title" id="hero-title">
                <span className="hero__title-line hero-intro hero-intro--two">
                  {hero.titleLead}
                </span>
                <span className="hero__title-line hero-intro hero-intro--three">
                  <em>{hero.titleAccent}</em>
                </span>
              </h1>
              <p className="hero__lede hero-intro hero-intro--four">{hero.lede}</p>
              <div className="hero__actions hero-intro hero-intro--five">
                <a className="button button--primary" href={hero.primaryCta.href}>
                  {hero.primaryCta.label}
                  <span className="button__arrow" aria-hidden="true">↗</span>
                </a>
                <a className="button button--text" href={hero.secondaryCta.href}>
                  {hero.secondaryCta.label}
                  <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>

            <HeroVisual />
          </div>

          <div className="hero__signal-list" aria-label="The strategic process">
            {hero.signals.map((item) => (
              <div className="hero-signal" key={item.number}>
                <span className="hero-signal__number">{item.number}</span>
                <span className="hero-signal__label">{item.label}</span>
                <span className="hero-signal__note">{item.note}</span>
              </div>
            ))}
          </div>
          <a className="hero__scroll-cue" href="#perspective">
            <span>Scroll to explore</span>
            <span className="hero__scroll-line" aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="manifesto section" id="perspective" aria-labelledby="manifesto-title">
        <div className="shell">
          <div className="section-topline">
            <p className="eyebrow">{manifesto.eyebrow}</p>
            <span className="section-index">01 / PERSPECTIVE</span>
          </div>
          <div className="manifesto__grid">
            <h2 className="manifesto__heading" id="manifesto-title" data-reveal="up">
              {manifesto.heading}
            </h2>
            <div className="manifesto__aside" data-reveal="up">
              <p>{manifesto.body}</p>
              <p className="manifesto__closing">{manifesto.closing}</p>
            </div>
          </div>
          <div className="manifesto__axis" aria-hidden="true" data-reveal="up">
            <span>NOISE</span>
            <span className="manifesto__axis-line"><i /></span>
            <span>SIGNAL</span>
          </div>
        </div>
      </section>

      <section className="expertise section" id="expertise" aria-labelledby="expertise-title">
        <div className="shell">
          <div className="section-topline">
            <p className="eyebrow">{expertise.eyebrow}</p>
            <span className="section-index">02 / EXPERTISE</span>
          </div>
          <div className="expertise__intro">
            <h2 className="section-heading" id="expertise-title" data-reveal="up">
              {expertise.heading}
            </h2>
            <p data-reveal="up">{expertise.intro}</p>
          </div>
          <ol className="expertise-grid">
            {expertise.items.map((item, index) => (
              <li className="expertise-card" key={item.number} data-reveal="up">
                <div className="expertise-card__top">
                  <span className="expertise-card__number">{item.number}</span>
                  <span className="expertise-card__code">{item.code}</span>
                </div>
                <div className="expertise-card__graphic" aria-hidden="true">
                  <span className={`expertise-card__graphic-ring expertise-card__graphic-ring--${index + 1}`} />
                  <span className="expertise-card__graphic-dot" />
                  <span className="expertise-card__graphic-line" />
                </div>
                <h3>{item.title}</h3>
                <p className="expertise-card__body">{item.body}</p>
                <ul className="expertise-card__tags" aria-label={`${item.title} topics`}>
                  {item.tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              </li>
            ))}
          </ol>
          <p className="expertise__footnote">
            The deliverable is never the starting point. The problem is.
            <FlowArrow />
          </p>
        </div>
      </section>

      <section className="method section" id="method" aria-labelledby="method-title">
        <div className="shell">
          <div className="section-topline">
            <p className="eyebrow">{method.eyebrow}</p>
            <span className="section-index">03 / METHOD</span>
          </div>
          <div className="method__intro">
            <h2 className="section-heading" id="method-title" data-reveal="up">
              {method.heading}
            </h2>
            <p data-reveal="up">{method.intro}</p>
          </div>
          <ol className="method-list">
            {method.steps.map((step) => (
              <li className="method-step" key={step.number} data-reveal="left">
                <div className="method-step__rail">
                  <span>{step.number}</span>
                  <i aria-hidden="true" />
                </div>
                <div className="method-step__main">
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
                <p className="method-step__output">
                  <span>THE OUTPUT</span>
                  {step.output}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="rexo-section" id="rexo" aria-labelledby="rexo-title">
        <div className="shell">
          <div className="rexo-panel" data-reveal="scale">
            <div className="rexo-panel__background" aria-hidden="true">R</div>
            <div className="rexo-panel__top">
              <p className="eyebrow">{rexoSection.eyebrow}</p>
              <span className="rexo-panel__meta">{rexoSection.meta}</span>
            </div>
            <div className="rexo-panel__body">
              <div className="rexo-panel__copy">
                <h2 id="rexo-title">{rexoSection.heading}</h2>
                <p>{rexoSection.body}</p>
                <p className="rexo-panel__secondary">{rexoSection.secondary}</p>
              </div>
              <ol className="rexo-flow">
                {rexoSection.diagram.map((step) => (
                  <li key={step.number}>
                    <span className="rexo-flow__number">{step.number}</span>
                    <span className="rexo-flow__label">{step.label}</span>
                    <span className="rexo-flow__note">{step.note}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rexo-panel__footer">
              <div className="rexo-panel__links">
                {rexoSection.ctas.map((cta) => (
                  <a key={cta.href} href={cta.href} target="_blank" rel="noopener noreferrer">
                    {cta.label}
                    <ExtArrow />
                  </a>
                ))}
              </div>
              <a className="rexo-panel__home" href="https://rexo.agency/" target="_blank" rel="noopener noreferrer">
                rexo.agency <ExtArrow />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="notes section" id="notes" aria-labelledby="notes-title">
        <div className="shell">
          <div className="section-topline">
            <p className="eyebrow">{notes.eyebrow}</p>
            <span className="section-index">04 / WRITING</span>
          </div>
          <div className="notes__intro">
            <h2 className="section-heading" id="notes-title" data-reveal="up">
              {notes.heading}
            </h2>
            <p data-reveal="up">{notes.body}</p>
          </div>
          <div className="notes-grid">
            {notes.items.map((item, index) => (
              <a
                className="note-card"
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                data-reveal="up"
              >
                <span className="note-card__type">{item.type}</span>
                <span className="note-card__number">0{index + 1}</span>
                <span className="note-card__title">{item.title}</span>
                <span className="note-card__description">{item.description}</span>
                <span className="note-card__action">
                  {item.action} <ExtArrow />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="about section" id="about" aria-labelledby="about-title">
        <div className="shell">
          <div className="section-topline">
            <p className="eyebrow">{about.eyebrow}</p>
            <span className="section-index">05 / ABOUT</span>
          </div>
          <div className="about__grid">
            <h2 className="section-heading about__heading" id="about-title" data-reveal="up">
              {about.heading}
            </h2>
            <div className="about__copy" data-reveal="up">
              {about.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
          </div>
          <div className="about__signature" aria-label="Aria Kianzad">
            <span>AK</span>
            <span>Aria Kianzad</span>
          </div>
        </div>
      </section>

      <section className="contact section" id="contact" aria-labelledby="contact-title">
        <div className="shell">
          <div className="section-topline">
            <p className="eyebrow">{contactSection.eyebrow}</p>
            <span className="section-index">06 / CONTACT</span>
          </div>
          <div className="contact__content">
            <h2 id="contact-title" data-reveal="up">{contactSection.heading}</h2>
            <p data-reveal="up">{contactSection.body}</p>
            <div className="contact__actions" data-reveal="up">
              <a className="contact__email" href={contactSection.cta.href}>
                {contactSection.cta.label}
                <ExtArrow />
              </a>
              <span className="contact__address">{contactSection.email}</span>
              <button className="copy-btn" type="button" data-copy={contactSection.email}>
                {contactSection.copyLabel}
              </button>
              <span className="copy-status" id="copy-status" role="status" aria-live="polite" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
