import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (multiple lockfiles exist above this dir).
  turbopack: { root: __dirname },
  // Native / heavy server-only modules must not be bundled by webpack/turbopack.
  serverExternalPackages: ["better-sqlite3", "sharp", "satori"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
