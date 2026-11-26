/**
 * Public-facing copy for Aria Kianzad's personal website.
 * First-person, precise and understated. No invented clients, outcomes or metrics.
 */

export const hero = {
  eyebrow: "Brand strategy / Creative copywriting / Personal branding",
  titleLead: "Find the difference.",
  titleAccent: "Make it matter.",
  lede:
    "I'm Aria Kianzad, a brand strategist and creative copywriter. I help brands get clear on what makes them different, then turn that into a clear position, a distinct voice and words people remember.",
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
  heading: "Clarity isn't the opposite of ambition. It's how a brand earns attention.",
  body:
    "Every market is full of brands trying to get noticed. The real question is what's worth saying, who needs to hear it, and why they'd care.",
  closing: "Brands grow when they communicate with intention, not volume.",
} as const;

export const expertise = {
  eyebrow: "Where I work",
  heading: "Strategy first. Everything else follows.",
  intro:
    "A strong brand isn't a pile of disconnected deliverables. It's a clear position, brought to life through identity, storytelling and the way the business communicates.",
  items: [
    {
      number: "01",
      code: "DISCOVER",
      title: "Research & insight",
      body:
        "Before deciding what a brand should say, I want to understand the people around it: how customers behave, what the market rewards and where competitors are all saying the same thing.",
      tags: ["Consumer insight", "Market research", "Competitive analysis"],
    },
    {
      number: "02",
      code: "DEFINE",
      title: "Positioning & identity",
      body:
        "Get clear on the difference a brand can genuinely own, why it matters to its audience and how it should shape the brand's identity, voice and place in the market.",
      tags: ["Brand positioning", "Brand identity", "Verbal identity"],
    },
    {
      number: "03",
      code: "EXPRESS",
      title: "Content & communication",
      body:
        "I turn that direction into a clear communication system, from messaging and storytelling to content strategy, creative copywriting and search-focused content.",
      tags: ["Content strategy", "Storytelling", "Copywriting"],
    },
  ],
} as const;

export const method = {
  eyebrow: "The working method",
  heading: "The most important work happens before the first line.",
  intro:
    "I don't start with a format or a headline. First, I need to understand what the brand is trying to solve, who it's speaking to and what needs to change.",
  steps: [
    {
      number: "01",
      title: "Listen",
      body: "Get clear on the business, what it's trying to do, what can't change and the question that needs an answer.",
      output: "The real problem",
    },
    {
      number: "02",
      title: "Investigate",
      body: "Look at the audience, category, competition and behaviour around the brand. The point is to separate what we assume from what we can actually use.",
      output: "A sharper view",
    },
    {
      number: "03",
      title: "Position",
      body: "Find the difference the brand can credibly own, who it matters to and why anyone should care.",
      output: "A clear direction",
    },
    {
      number: "04",
      title: "Express",
      body: "Bring the position to life through identity, messaging and communication people can recognise and understand.",
      output: "A coherent system",
    },
  ],
} as const;

export const rexoSection = {
  eyebrow: "Strategy put into practice",
  meta: "Founded in 2024",
  heading: "A place for ideas to become real.",
  body:
    "I started Rexo to bring strategic thinking and creative work into the same conversation. We start by understanding what makes a business different, why that difference matters and how it should show up.",
  secondary:
    "The work spans brand strategy, creative direction, identity and campaigns. The brief shapes the work, not a fixed list of services.",
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
    "I use my own blog to think through brand strategy, positioning, communication and the choices that shape how people see a business.",
  items: [
    {
      type: "Personal blog",
      title: "My personal blog",
      description:
        "I write about brand strategy, positioning, creative work and the words that help people make sense of a brand. It's where I explore the thinking behind the work, one idea at a time.",
      href: "/blog/",
      action: "Read the blog",
    },
  ],
} as const;

export const about = {
  eyebrow: "A little context",
  heading: "Curious about what makes people understand.",
  paragraphs: [
    "I'm Aria Kianzad, a brand strategist and creative copywriter. I work with brands and people to get clear on what makes them distinct, then shape how that difference comes through in positioning, identity and communication. Personal branding is part of that work: making sure the way you show up feels like you, and makes sense to the people you want to reach.",
    "I started out closer to technology. That experience left me curious about patterns, behaviour and the questions hiding behind the obvious answers. I still bring that way of thinking into brand work, just with a different set of tools.",
    "I founded Rexo in 2024 to bring strategy and creative execution closer together. I also write on my own blog about branding, communication and the choices that shape perception.",
  ],
} as const;

export const contactSection = {
  eyebrow: "Start here",
  heading: "Got a brand question you're trying to untangle?",
  body:
    "Tell me what you're working on, what's not quite clicking, or what you want people to understand. We can start there and work out what the project actually needs.",
  email: "kianzadaria@gmail.com",
  cta: { label: "Email Me", href: "mailto:kianzadaria@gmail.com" },
  copyLabel: "Copy email",
} as const;

export const footer = {
  note: "Brand strategy / Positioning / Communication",
  copyright: "© 2027 Aria Kianzad. All rights reserved.",
} as const;
