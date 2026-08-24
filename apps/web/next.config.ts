import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {}, // Required for Next.js 16 to avoid webpack/turbopack error
};

// Using manual service worker (public/sw.js) instead of next-pwa
// due to Next.js 16 compatibility issues
export default nextConfig;
