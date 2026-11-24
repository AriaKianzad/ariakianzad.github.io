import type { ReactNode } from "react";
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
  const accent = /^#[0-9a-f]{6}$/i.test(settings.accent_color || "") ? settings.accent_color : "#a86f54";
  const headingScaleValue = Number(settings.heading_scale);
  const headingScale = Number.isFinite(headingScaleValue) ? Math.min(1.25, Math.max(0.85, headingScaleValue)) : 1;
  const lineHeightValue = Number(settings.body_line_height);
  const lineHeight = Number.isFinite(lineHeightValue) ? Math.min(2.4, Math.max(1.6, lineHeightValue)) : 1.95;
  const themeCss = [
    ".blog-theme {",
    "  --blog-accent: " + accent + ";",
    "  --blog-heading-scale: " + headingScale + ";",
    "  --blog-line-height: " + lineHeight + ";",
    "}",
  ].join("\n");
  const language = settings.default_language === "fa" ? "fa" : "en";
  return (
    <>
      <style>{themeCss}</style>
      <div
        className={"blog-theme theme-" + (settings.background_theme || "paper") + " layout-" + (settings.layout_style || "editorial") + " cards-" + (settings.card_style || "editorial")}
        lang={language}
      >
        {children}
      </div>
    </>
  );
}
