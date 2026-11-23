import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages. The interactive Three.js hero is bundled
 * separately by esbuild after export, so it does not enter the Next.js runtime.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
