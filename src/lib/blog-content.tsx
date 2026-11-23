import { createElement, type ReactNode } from "react";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export type BlogFaq = { question: string; answer: string };
export type BlogPost = {
  slug: string; title: string; excerpt: string; content: string; language: "fa" | "en";
  category: string; tags: string[]; heroImageUrl?: string | null; heroImageAlt?: string;
  heroImageCaption?: string; ogImageUrl?: string; seoTitle?: string; metaDescription?: string;
  focusKeyword?: string; canonicalUrl?: string; ogTitle?: string; ogDescription?: string;
  robotsIndex?: boolean; robotsFollow?: boolean; featured?: boolean; tocEnabled?: boolean;
  dropCap?: boolean; contentWidth?: "reading" | "wide"; accentColor?: string;
  faqs?: BlogFaq[]; publishedAt?: string; updatedAt?: string;
};
export type BlogSettings = {
  title: string; tagline: string; description: string;
  backgroundTheme: "paper" | "white" | "warm"; accentColor: string;
  cardStyle: "editorial" | "minimal" | "image-led"; postsPerPage: number;
  showSearch: boolean; showCategories: boolean; showFeatured: boolean; showReadingTime: boolean;
  defaultMetaTitle: string; defaultMetaDescription: string; defaultOgImage: string; footerNote: string;
};

const directory = path.join(process.cwd(), "src", "content", "blog");
const defaults: BlogSettings = {
  title: "نوشته‌ها",
  tagline: "یادداشت‌هایی درباره برند، معنا و ارتباط",
  description: "مقاله‌ها و یادداشت‌هایی درباره استراتژی برند، پرسونال برندینگ و ارتباطات.",
  backgroundTheme: "paper",
  accentColor: "#405a42",
  cardStyle: "editorial",
  postsPerPage: 9,
  showSearch: true,
  showCategories: true,
  showFeatured: true,
  showReadingTime: true,
  defaultMetaTitle: "وبلاگ آریا کیانزاد",
  defaultMetaDescription: "یادداشت‌هایی درباره استراتژی برند، پرسونال برندینگ و ارتباطات.",
  defaultOgImage: "",
  footerNote: "فکرها، مشاهده‌ها و یادداشت‌هایی درباره برند و ارتباط.",
};

export async function getBlogSettings(): Promise<BlogSettings> {
  try {
    const raw = JSON.parse(await readFile(path.join(directory, "settings.json"), "utf8"));
    const theme = ["paper", "white", "warm"].includes(raw.backgroundTheme) ? raw.backgroundTheme : "paper";
    const card = ["editorial", "minimal", "image-led"].includes(raw.cardStyle) ? raw.cardStyle : "editorial";
    return {
      ...defaults, ...raw, backgroundTheme: theme, cardStyle: card,
      accentColor: /^#[0-9a-fA-F]{6}$/.test(raw.accentColor || "") ? raw.accentColor : defaults.accentColor,
      postsPerPage: Math.max(3, Math.min(24, Number(raw.postsPerPage) || 9)),
    };
  } catch {
    return defaults;
  }
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "settings.json");
    const posts = await Promise.all(files.map(async (entry) => {
      try {
        const post = JSON.parse(await readFile(path.join(directory, entry.name), "utf8")) as BlogPost;
        return post.slug && post.title && post.content ? post : null;
      } catch {
        return null;
      }
    }));
    return posts.filter((post): post is BlogPost => Boolean(post))
      .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
  } catch {
    return [];
  }
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  return (await getPublishedPosts()).find((post) => post.slug === slug) || null;
}

export async function getBlogCategories(): Promise<Array<{ name: string; count: number }>> {
  const counts = new Map<string, number>();
  (await getPublishedPosts()).forEach((post) => {
    const category = post.category?.trim();
    if (category) counts.set(category, (counts.get(category) || 0) + 1);
  });
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

export function readingTime(content: string, language: "fa" | "en" = "fa"): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / (language === "en" ? 220 : 180)));
}

export function formatBlogDate(value?: string, locale = "fa-IR"): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "long", day: "numeric",
  }).format(date);
}

export function categoryHref(category: string): string {
  return "/blog/category/" + encodeURIComponent(category) + "/";
}

function headingId(value: string, index: number): string {
  const latin = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return latin || "section-" + (index + 1);
}

export function extractHeadings(markdown: string): Array<{ id: string; title: string; level: number }> {
  const used = new Map<string, number>();
  let index = 0;
  return markdown.split("\n").flatMap((line) => {
    const match = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    if (!match) return [];
    const title = match[2].replace(/[*_~]/g, "");
    const base = headingId(title, index++);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    return [{ id: count ? base + "-" + (count + 1) : base, title, level: match[1].length }];
  });
}

const mediaPrefix = "https://bkohdqwecnvbmeaiuyyx.supabase.co/storage/v1/object/public/blog-media/";

function safeLink(value: string): string | null {
  const href = value.trim();
  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("mailto:")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeImage(value: string): string | null {
  const src = value.trim();
  return (src.startsWith("/") && !src.startsWith("//")) || src.startsWith(mediaPrefix) ? src : null;
}

function inlineNodes(source: string, prefix: string): ReactNode[] {
  const tick = String.fromCharCode(96);
  const pattern = new RegExp(
    "(!?\\[[^\\]]*\\]\\([^\\s)]+\\)|\\*\\*[^*]+\\*\\*|__[^_]+__|~~[^~]+~~|\\*[^*]+\\*|_[^_]+_|" +
    tick + "[^" + tick + "]+" + tick + ")",
    "g",
  );
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(source))) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index));
    const token = match[0];
    const key = prefix + "-" + index++;
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token);
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
    if (image) {
      const src = safeImage(image[2]);
      nodes.push(src
        ? createElement("span", { className: "article-image-inline", key },
            createElement("img", { src, alt: image[1], loading: "lazy", decoding: "async" }))
        : image[1]);
    } else if (link) {
      const href = safeLink(link[2]);
      nodes.push(href
        ? createElement("a", {
            href, key,
            ...(href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {}),
          }, ...inlineNodes(link[1], key))
        : link[1]);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(createElement("strong", { key }, token.slice(2, -2)));
    } else if (token.startsWith("~~")) {
      nodes.push(createElement("del", { key }, token.slice(2, -2)));
    } else if (token.startsWith("*") || token.startsWith("_")) {
      nodes.push(createElement("em", { key }, token.slice(1, -1)));
    } else {
      nodes.push(createElement("code", { key }, token.slice(1, -1)));
    }
    cursor = pattern.lastIndex;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

function tableNode(lines: string[], key: string): ReactNode {
  const rows = lines.map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split("|").map((cell) => cell.trim()));
  return createElement("div", { className: "article-table-scroll", key },
    createElement("table", null,
      createElement("thead", null, createElement("tr", null, ...(rows[0] || []).map((cell, i) =>
        createElement("th", { key: i }, ...inlineNodes(cell, key + "-h" + i))))),
      createElement("tbody", null, ...rows.slice(2).map((row, ri) =>
        createElement("tr", { key: ri }, ...row.map((cell, ci) =>
          createElement("td", { key: ci }, ...inlineNodes(cell, key + "-r" + ri + "c" + ci))))))));
}

export function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const output: ReactNode[] = [];
  let index = 0;
  let headingIndex = 0;
  const usedIds = new Map<string, number>();
  const fence = String.fromCharCode(96).repeat(3);

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }

    if (line.startsWith(fence)) {
      const language = line.slice(3).trim().replace(/[^a-z0-9_+-]/gi, "").slice(0, 24);
      index++;
      const code: string[] = [];
      while (index < lines.length && !lines[index].startsWith(fence)) code.push(lines[index++]);
      if (index < lines.length) index++;
      output.push(createElement("pre", { key: "code-" + output.length, "data-language": language || undefined },
        createElement("code", null, code.join("\n"))));
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      output.push(createElement("hr", { key: "hr-" + output.length }));
      index++;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const level = Math.max(2, heading[1].length);
      const title = heading[2];
      const base = headingId(title.replace(/[*_~]/g, ""), headingIndex++);
      const count = usedIds.get(base) || 0;
      usedIds.set(base, count + 1);
      const id = count ? base + "-" + (count + 1) : base;
      output.push(createElement(level === 2 ? "h2" : level === 3 ? "h3" : "h4",
        { key: id, id }, ...inlineNodes(title, id)));
      index++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
      output.push(createElement("blockquote", { key: "quote-" + output.length },
        ...quote.map((item, i) => createElement("p", { key: i }, ...inlineNodes(item, "q" + i)))));
      continue;
    }

    if (/^\|.*\|$/.test(line) && index + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const table: string[] = [];
      while (index < lines.length && /^\|.*\|$/.test(lines[index])) table.push(lines[index++]);
      output.push(tableNode(table, "table-" + output.length));
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const matcher = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/;
      const items: string[] = [];
      while (index < lines.length && matcher.test(lines[index])) items.push(lines[index++].replace(matcher, ""));
      output.push(createElement(ordered ? "ol" : "ul", { key: "list-" + output.length },
        ...items.map((item, i) => createElement("li", { key: i }, ...inlineNodes(item, "li" + i)))));
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() &&
      !/^(#{1,4})\s/.test(lines[index]) &&
      !lines[index].startsWith(fence) &&
      !/^>\s?/.test(lines[index]) &&
      !/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])) paragraph.push(lines[index++]);
    output.push(createElement("p", { key: "p-" + output.length },
      ...inlineNodes(paragraph.join("\n"), "p" + output.length)));
  }
  return output;
}
