import type { CSSProperties, ReactNode } from "react";
import { getBlogSettings } from "@/lib/blog-data";
import "./blog.css";

export default function BlogLayout({ children }: { children: ReactNode }) {
  const settings = getBlogSettings();
  const style = { "--blog-accent": settings.accent_color } as CSSProperties;
  return (
    <div
      className={"blog-theme theme-" + (settings.background_theme || "paper") + " layout-" + (settings.layout_style || "editorial")}
      style={style}
    >
      {children}
    </div>
  );
}
