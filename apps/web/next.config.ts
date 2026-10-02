import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {}, // Required for Next.js 16 to avoid webpack/turbopack error
  // @agam/shared ships TypeScript source (no build step) so it stays a single
  // source of truth for web, api and the mobile app.
  transpilePackages: ["@agam/shared"],
};

// Using manual service worker (public/sw.js) instead of next-pwa
// due to Next.js 16 compatibility issues
export default nextConfig;
