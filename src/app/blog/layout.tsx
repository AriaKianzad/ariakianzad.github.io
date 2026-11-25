import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { getBlogSettings } from "@/lib/blog-data";
import "./blog.css";

export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/blog-favicon.svg", type: "image/svg+xml" }],
    shortcut: ["/blog-favicon.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f1e9",
};

export default function BlogLayout({ children }: { children: ReactNode }) {
  const settings = getBlogSettings();
  const language = settings.default_language === "en" ? "en" : "fa";
  const direction = language === "fa" ? "rtl" : "ltr";
  const style = {
      "--blog-accent": settings.accent_color || "#a86f54",
      "--blog-heading-scale": String(settings.heading_scale || 1),
      "--blog-line-height": String(settings.body_line_height || 1.95),
    } as CSSProperties;
  return (
    <div
      lang={language}
      dir={direction}
      className={"blog-theme theme-" + (settings.background_theme || "paper") + " layout-" + (settings.layout_style || "editorial") + " cards-" + (settings.card_style || "editorial")}
      style={style}
    >
      <script src="/admin/config.js" />
      <script src="/blog-ad-click.js" />
      {children}
    </div>
  );
}
