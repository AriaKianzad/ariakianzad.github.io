import type { NextConfig } from "next";

/**
 Fully static export. Every page is pre-rendered to `out/`;
 no server runtime, no client JS bundle (the postbuild script
 strips Next's inline runtime so a strict CSP holds).
 */
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
