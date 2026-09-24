import "server-only";
import { NextResponse } from "next/server";
import { repo } from "./db";

// ============================================================
// Rate limiting. Fixed windows counted in Postgres, so the limit holds across
// every serverless instance (an in-memory counter on Vercel resets per
// cold start and per instance — it would barely limit anything).
//
// Fails OPEN: if the database is unreachable we log and allow the request.
// A rate limiter must never be the thing that takes the product down.
// ============================================================

export type Limit = { limit: number; windowMs: number };

/** Returns a 429 response when over the limit, otherwise null. */
export async function rateLimit(key: string, { limit, windowMs }: Limit): Promise<NextResponse | null> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  let hits: number;
  try {
    hits = await repo.hitRateLimit(key, windowStart);
  } catch (err) {
    console.error("rate-limit store unavailable — failing open", err);
    return null;
  }
  if (hits <= limit) return null;

  const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
  return NextResponse.json(
    { error: "Too many requests — please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfter),
        "x-ratelimit-limit": String(limit),
        "x-ratelimit-remaining": "0",
      },
    }
  );
}

/**
 * The caller's IP. On Vercel the platform sets x-forwarded-for and x-real-ip
 * itself, so the first hop is trustworthy there.
 */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}
