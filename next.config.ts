import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages. Three.js is bundled locally and the
 * interactive hero scene is dynamically imported only in the browser.
 */
const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["three"],
};

export default nextConfig;
