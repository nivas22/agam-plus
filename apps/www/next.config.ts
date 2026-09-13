import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {}, // Required for Next.js 16 to avoid webpack/turbopack error
};

export default nextConfig;
