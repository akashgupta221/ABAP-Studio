import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only used by the local bun server; Vercel builds its own bundle.
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  devIndicators: false,
  reactStrictMode: false,
};

export default nextConfig;
