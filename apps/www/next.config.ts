import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {}, // Required for Next.js 16 to avoid webpack/turbopack error
  // @agam/shared ships TypeScript source (no build step).
  transpilePackages: ["@agam/shared"],
};

export default nextConfig;
