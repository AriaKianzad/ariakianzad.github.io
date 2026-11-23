import type { CSSProperties, ReactNode } from "react";
import { getBlogSettings } from "@/lib/blog-data";
import "./blog.css";

export default function BlogLayout({ children }: { children: ReactNode }) {
  const settings = getBlogSettings();
  const style = {
      "--blog-accent": settings.accent_color || "#a86f54",
      "--blog-heading-scale": String(settings.heading_scale || 1),
      "--blog-line-height": String(settings.body_line_height || 1.95),
    } as CSSProperties;
  return (
    <div
      className={"blog-theme theme-" + (settings.background_theme || "paper") + " layout-" + (settings.layout_style || "editorial") + " cards-" + (settings.card_style || "editorial")}
      style={style}
    >
      {children}
    </div>
  );
}
