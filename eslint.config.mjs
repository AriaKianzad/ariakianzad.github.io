import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "node_modules/**", "next-env.d.ts"]),
  {
    /*
     * This project exports fully static HTML with no Next.js client runtime
     * (scripts/strip-next-runtime.mjs removes the inline bootstrap, so a
     * strict CSP holds). next/link would only emit runtime references that
     * are stripped again, and public/boot.js must run synchronously before
     * first paint. Both rules therefore have nothing to do here.
     */
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-sync-scripts": "off",
    },
  },
]);
