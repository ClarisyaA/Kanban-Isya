import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root (a parent folder has its own lockfile).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
