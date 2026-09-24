import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { availableLlmProvider, llmHealth } from "@/lib/llm";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// Liveness + dependency health for uptime monitors and post-deploy smoke
// tests. 200 when the product can serve campaigns; 503 when the database is
// down. The LLM is reported but never fails the check — every AI path has a
// deterministic fallback, so a model outage degrades, it doesn't break.
// Exposes no secrets, emails or error bodies — only up/down and model names.
// ============================================================

const started = Date.now();

export async function GET(request: Request) {
  const limited = await rateLimit(`health:${clientIp(request)}`, { limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const t0 = performance.now();
  let db: { ok: boolean; backend?: string; ms?: number };
  try {
    const backend = await Promise.race([
      repo.ping(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3_000)),
    ]);
    db = { ok: true, backend, ms: Math.round(performance.now() - t0) };
  } catch {
    db = { ok: false };
  }

  const provider = availableLlmProvider();
  // Last observed call per provider on this instance (no probe — probes cost money).
  const last = Object.fromEntries(
    Object.entries(llmHealth).map(([p, h]) => [p, { ok: h.ok, model: h.model, at: h.at }])
  );

  const body = {
    status: db.ok ? (provider ? "ok" : "degraded") : "down",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    uptimeSec: Math.round((Date.now() - started) / 1000),
    checks: {
      database: db,
      llm: { configured: provider ?? "none — deterministic engine", fallback: "rules", last },
    },
  };
  return NextResponse.json(body, {
    status: db.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
