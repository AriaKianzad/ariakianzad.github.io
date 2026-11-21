/**
 * Public-facing copy for Aria Kianzad's personal website.
 * First-person, precise and understated. No invented clients, outcomes or metrics.
 */

export const hero = {
  eyebrow: "Brand strategy / Positioning / Communication",
  titleLead: "Find the difference.",
  titleAccent: "Make it matter.",
  lede:
    "I'm Aria Kianzad. I help brands turn research and insight into a distinct position, then translate that thinking into identity and communication people can understand, remember and choose.",
  primaryCta: { label: "Start a conversation", href: "mailto:kianzadaria@gmail.com" },
  secondaryCta: { label: "Explore my approach", href: "/#method" },
  signals: [
    { number: "01", label: "Insight", note: "Understand what is true" },
    { number: "02", label: "Position", note: "Decide what should matter" },
    { number: "03", label: "Expression", note: "Make the meaning clear" },
  ],
} as const;

export const manifesto = {
  eyebrow: "The point of view",
  heading: "Clarity is not the opposite of ambition. It is how a brand earns attention.",
  body:
    "The market is full of messages competing to be noticed. The useful question is not how to say more. It is what deserves to be said, who needs to hear it, and why it should matter to them.",
  closing: "Brands grow when they communicate with intention, not volume.",
} as const;

export const expertise = {
  eyebrow: "Where I work",
  heading: "Strategy first. Everything else follows.",
  intro:
    "A strong brand is not a collection of disconnected deliverables. It is a clear idea, understood by the right people and expressed consistently.",
  items: [
    {
      number: "01",
      code: "DISCOVER",
      title: "Research & insight",
      body:
        "Understand the people, category and context around a business. I look at customer behaviour, market dynamics and the competitive landscape before deciding what a brand should say.",
      tags: ["Consumer insight", "Market research", "Competitive analysis"],
    },
    {
      number: "02",
      code: "DEFINE",
      title: "Positioning & identity",
      body:
        "Find the difference a brand can credibly own, why it matters, and how that position should shape its identity, voice and place in the market.",
      tags: ["Brand positioning", "Brand identity", "Verbal identity"],
    },
    {
      number: "03",
      code: "EXPRESS",
      title: "Content & communication",
      body:
        "Turn strategic direction into a coherent communication system, from messaging and storytelling to content strategy, copywriting and search-led content.",
      tags: ["Content strategy", "Storytelling", "Copywriting", "SEO content"],
    },
  ],
} as const;

export const method = {
  eyebrow: "The working method",
  heading: "The most important work happens before the first line.",
  intro:
    "I don't begin with a format or a predetermined deliverable. I begin by understanding the decision a brand needs to make.",
  steps: [
    {
      number: "01",
      title: "Listen",
      body: "Understand the business, its ambitions, its constraints and the question that brought us here.",
      output: "The real problem",
    },
    {
      number: "02",
      title: "Investigate",
      body: "Study the audience, category, competition and behaviour around the brand. Separate assumptions from useful signals.",
      output: "A sharper view",
    },
    {
      number: "03",
      title: "Position",
      body: "Define the difference worth owning, the people it matters to and the reason they should care.",
      output: "A clear direction",
    },
    {
      number: "04",
      title: "Express",
      body: "Translate the position into identity, messaging and communication people can recognise and understand.",
      output: "A coherent system",
    },
  ],
} as const;

export const rexoSection = {
  eyebrow: "Strategy put into practice",
  meta: "Founded in 2024",
  heading: "A place for ideas to become real.",
  body:
    "I founded Rexo to bring strategic thinking and creative execution into the same conversation. The work starts by understanding what makes a business different, deciding why that difference matters, and giving it a coherent way to show up.",
  secondary:
    "Rexo works across brand strategy, creative direction, identity and campaigns. The scope follows the problem, not the other way around.",
  diagram: [
    { number: "01", label: "Understand", note: "The business and its context" },
    { number: "02", label: "Position", note: "The difference worth owning" },
    { number: "03", label: "Express", note: "A clear and consistent presence" },
  ],
  ctas: [
    { label: "Rexo brand strategy", href: "https://rexo.agency/services/brand-strategy" },
    { label: "Rexo creative campaigns", href: "https://rexo.agency/services/creative-campaigns" },
  ],
} as const;

export const notes = {
  eyebrow: "Ideas in progress",
  heading: "Thinking is part of the work.",
  body:
    "I write about the choices behind brands: positioning, communication, content and the small details that change how people understand a business.",
  items: [
    {
      type: "Persian editorial platform",
      title: "RexoMag",
      description:
        "A Persian publication for practical ideas on branding, content and business.",
      href: "https://rexo.agency/mag",
      action: "Explore RexoMag",
    },
    {
      type: "Essays and notes",
      title: "Medium",
      description:
        "Longer thoughts on brand strategy, positioning, storytelling and communication.",
      href: "https://medium.com/@AriaKianzad",
      action: "Read on Medium",
    },
  ],
} as const;

export const about = {
  eyebrow: "A little context",
  heading: "Curious about what makes people understand.",
  paragraphs: [
    "I'm Aria Kianzad, a brand strategist and personal branding consultant. I'm interested in the gap between what a business is and what people understand about it. My work begins with research, customer behaviour and market context, then moves into positioning and the way that position gets communicated.",
    "My path started closer to technology. It left me with a habit of looking for patterns, asking better questions and not taking the first answer at face value. Today, that same curiosity shapes how I think about brands.",
    "I founded Rexo in 2024 to bring strategy and creative execution closer together. Alongside that work, I write about branding, communication and the decisions that shape perception.",
  ],
} as const;

export const contactSection = {
  eyebrow: "Start here",
  heading: "Have a brand question worth getting clear on?",
  body:
    "Tell me what you're building, what feels unresolved, or what you want people to understand. We can start with the question before deciding on the answer.",
  email: "kianzadaria@gmail.com",
  cta: { label: "Email Aria", href: "mailto:kianzadaria@gmail.com" },
  copyLabel: "Copy email",
} as const;

export const footer = {
  note: "Brand strategy / Positioning / Communication",
  copyright: `© ${new Date().getFullYear()} Aria Kianzad. All rights reserved.`,
} as const;
