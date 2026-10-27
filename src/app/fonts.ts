import localFont from "next/font/local";

/**
 * Estedad, the primary typeface for the entire site.
 *
 * Source of truth: the official v8.5 release by Amin Abedi
 * (https://github.com/aminabedi68/Estedad, releases/tag/8.5), whose
 * `Estedad[wght].woff2` is copied here as `estedad-variable.woff2`.
 * Verified before adoption:
 * - genuine variable font, `wght` axis spanning 100 to 900 (fvar table);
 * - full Latin coverage (basic Latin, punctuation, curly quotes, dashes);
 * - SIL Open Font License 1.1 (`OFL.txt` in the repository, included at the
 *   project root and in public/).
 *
 * One variable file covers every weight used, so `next/font/local` gets a
 * single source with the full weight range. `display: swap` keeps text on a
 * system fallback for at most one frame, then swaps; next/font also derives
 * a size-adjusted fallback face so the swap does not shift layout.
 */
export const estedad = localFont({
  src: [{ path: "./fonts/estedad-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-estedad",
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
});

/**
 * Geist Mono, reserved for indices, eyebrows, and annotations.
 * Latin subset served by Google Fonts (v6), SIL Open Font License 1.1.
 */
export const geistMono = localFont({
  src: [{ path: "./fonts/geist-mono-latin.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-geist-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});
