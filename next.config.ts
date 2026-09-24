import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Clerk's Frontend API host is encoded in the publishable key
 * (pk_test_<base64(host$)>). Deriving it keeps the CSP correct for both the
 * dev instance and a future production instance without hand-editing.
 */
function clerkFapiHost(): string | null {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk) return null;
  try {
    const host = Buffer.from(pk.split("_")[2] ?? "", "base64").toString("utf8").replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}

const clerk = [clerkFapiHost(), "https://*.clerk.accounts.dev", "https://*.clerk.com"].filter(Boolean).join(" ");

/**
 * Content-Security-Policy. The anti-clickjacking, anti-injection and
 * anti-exfiltration directives are strict; script-src keeps 'unsafe-inline'
 * because Next.js hydration and the no-flash theme script are inline —
 * moving to per-request nonces is the documented next hardening step.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} ${clerk} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Posters are same-origin; brand logos and Clerk avatars are remote https.
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${clerk} https://clerk-telemetry.com ${isDev ? "ws: wss:" : ""}`,
  `frame-src ${clerk} https://challenges.cloudflare.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isDev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ")
  .replace(/\s{2,}/g, " ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // Pin the workspace root (multiple lockfiles exist above this dir).
  turbopack: { root: __dirname },
  // Heavy server-only modules must not be bundled by webpack/turbopack.
  serverExternalPackages: ["sharp", "@electric-sql/pglite", "@neondatabase/serverless"],
  // Poster fonts are read by fontconfig at runtime, not imported — the tracer
  // can't see them, so ship them with every server function explicitly.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**/*"] },
  // Only local images go through next/image. An open remotePatterns ("**")
  // would turn /_next/image into a free image proxy for any website.
  images: { remotePatterns: [] },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
