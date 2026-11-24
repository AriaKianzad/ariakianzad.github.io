import type { Metadata } from "next";
import NotFoundContent from "./NotFoundContent";
import "./not-found.css";

export const metadata: Metadata = {
  title: "Page not found | Aria Kianzad",
  description: "The requested page could not be found.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: null },
};

export default function NotFound() {
  return <NotFoundContent />;
}
