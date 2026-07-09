import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (multiple lockfiles exist above this dir).
  turbopack: { root: __dirname },
  // Heavy server-only modules must not be bundled by webpack/turbopack.
  serverExternalPackages: ["sharp", "@electric-sql/pglite", "@neondatabase/serverless"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
