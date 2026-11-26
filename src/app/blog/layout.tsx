import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { getBlogSettings } from "@/lib/blog-data";
import "./blog.css";

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f0e8",
};

export default function BlogLayout({ children }: { children: ReactNode }) {
  const settings = getBlogSettings();
  const language = settings.default_language === "en" ? "en" : "fa";
  const direction = language === "fa" ? "rtl" : "ltr";
  const boundedNumber = (value: number, min: number, max: number, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const headingScale = boundedNumber(settings.heading_scale, 0.85, 1.2, 1);
  const lineHeight = boundedNumber(settings.body_line_height, 1.6, 2.4, 1.95);
  const themeStyles = `.blog-theme{--blog-heading-scale:${headingScale};--blog-line-height:${lineHeight}}`;
  return (
    <div
      lang={language}
      dir={direction}
      className={"blog-theme theme-" + (settings.background_theme || "paper") + " layout-" + (settings.layout_style || "editorial") + " cards-" + (settings.card_style || "editorial")}
    >
      <style>{themeStyles}</style>
      <script src="/admin/config.js" />
      <script src="/blog-ad-click.js" />
      <script src="/blog-listing.js" defer />
      {children}
    </div>
  );
}
