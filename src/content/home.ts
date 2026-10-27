/**
 * All public-facing copy for the single-page site, in one place.
 *
 * Editorial rules applied throughout:
 * - first person, conversational, understated;
 * - no em dashes (commas, periods, colons, or parentheses instead);
 * - no invented facts: clients, numbers, awards, testimonials, or results.
 */

export const hero = {
  eyebrow: "Brand Strategy / Copywriting",
  headline: {
    lead: "I work on what a brand",
    middle: "needs to say, and why",
    end: "it should matter.",
  },
  lede: "I'm Aria. I help brands find a clearer position, then turn that thinking into words people can understand, remember, and act on.",
  primaryCta: { label: "Let's talk", href: "mailto:kianzadaria@gmail.com" },
  secondaryCta: { label: "Meet Rexo", href: "/#rexo" },
  /**
   * The strategist's index: each headline fragment named for the concept
   * behind it. This is the visual signature of the site.
   */
  index: [
    { n: "01", concept: "positioning", fragment: "what a brand needs to say" },
    { n: "02", concept: "relevance", fragment: "why it should matter" },
    { n: "03", concept: "expression", fragment: "words people can understand" },
  ],
} as const;

export const perspective = {
  eyebrow: "A point of view",
  heading: "More words aren't always the answer.",
  body: "Sometimes a brand doesn't need another campaign, another tagline, or another round of content. It needs a clearer answer to a simpler question.",
  /** Rendered as the accent moment of the section. */
  question: "what makes it worth choosing?",
  closing: "Strategy finds that answer. Writing gives it a form people can actually take in.",
} as const;

export const disciplines = {
  eyebrow: "The two disciplines",
  heading: "Two disciplines, one direction.",
  bridge: "Strategy decides the direction. Writing gives it a language.",
  items: [
    {
      n: "01",
      title: "Brand Strategy",
      body: "Before deciding what to say, I want to understand what a brand should stand for, who it needs to reach, and why someone should choose it over the alternatives.",
      notes: ["Positioning", "Differentiation", "Brand voice"],
    },
    {
      n: "02",
      title: "Copywriting",
      body: "Once the direction is clear, words have a job to do. I work on language that expresses the strategy clearly, sounds like the brand, and gives people a reason to pay attention.",
      notes: ["Messaging", "Web copy", "Naming"],
    },
  ],
} as const;

export const approach = {
  eyebrow: "How I work",
  heading: "Understand the problem before choosing the words.",
  items: [
    {
      n: "01",
      title: "Clarity before volume",
      body: "More output won't fix a message that doesn't make sense.",
    },
    {
      n: "02",
      title: "Difference needs a reason",
      body: "Being different is useful when there's something meaningful behind the difference.",
    },
    {
      n: "03",
      title: "Words are part of the strategy",
      body: "The way a brand speaks isn't the finishing touch. It shapes how the strategy reaches people.",
    },
  ],
  closing: "In practice, this looks less like producing more words and more like making the next decision well.",
} as const;

export const rexoSection = {
  eyebrow: "The biggest thing I've built",
  heading: "Meet Rexo.",
  body: "I founded Rexo to bring brand strategy and creative direction into the same conversation. The idea is simple: understand what makes a business different, decide why that difference matters, and give it a coherent way to show up in the world.",
  secondary:
    "At Rexo, the work starts with the problem, not a predetermined deliverable. Sometimes the answer is a sharper position. Sometimes it's a brand identity or a creative campaign. The scope follows what the business actually needs.",
  meta: "Independent studio, founded 2024",
  cta: { label: "Explore Rexo", href: "https://rexo.agency/", external: true },
  diagram: [
    { label: "Observe", note: "what the business is actually like" },
    { label: "Position", note: "why it deserves to be chosen" },
    { label: "Express", note: "how it speaks, consistently" },
  ],
} as const;

export const about = {
  eyebrow: "About",
  heading: "A little about how I think.",
  paragraphs: [
    "I'm interested in the space between what a business is and how people understand it. Brand strategy helps make sense of that gap. Copywriting gives the answers a language of their own.",
    "My path into this work began closer to technology, but over time I became more interested in the questions behind the output: what we're trying to communicate, who needs to understand it, and what makes the message worth remembering.",
    "These days, brand strategy and copywriting are at the center of my work. I'm especially interested in the decisions that make communication clearer, more distinctive, and more useful.",
  ],
} as const;

export const contactSection = {
  eyebrow: "Contact",
  heading: "Have something worth thinking through?",
  body: "Tell me a little about the brand, the problem, or the question you're working on. We can start there.",
  cta: { label: "Email me", href: "mailto:kianzadaria@gmail.com" },
  copyLabel: "Copy address",
  email: "kianzadaria@gmail.com",
} as const;

export const footer = {
  note: "Brand strategy & copywriting",
  copyright: `© ${new Date().getFullYear()} Aria Kianzad. All rights reserved.`,
} as const;
