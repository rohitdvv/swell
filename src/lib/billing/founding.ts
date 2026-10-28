import "server-only";
import { repo } from "@/lib/db";
import type { Subscription } from "../types";

// ============================================================
// Founding 100: the first hundred pay-for-proof restaurants keep a 10% share
// for life (everyone after pays the standard 15%). The counter on /pricing is
// the real count — no invented scarcity — and the rate is locked in the DB.
// ============================================================

export const FOUNDING_LIMIT = 100;
export const FOUNDING_RATE = 0.1;
export const STANDARD_RATE = 0.15;

export async function foundingStatus(): Promise<{ taken: number; limit: number; left: number }> {
  const taken = await repo.countPerformanceAccounts().catch(() => 0);
  return { taken, limit: FOUNDING_LIMIT, left: Math.max(0, FOUNDING_LIMIT - taken) };
}

/** Stamp the pay-for-proof rate on a subscription that's becoming "performance". */
export async function withPerformanceRate<T extends Subscription>(sub: T): Promise<T> {
  if (sub.plan !== "performance") return sub;
  const existing = await repo.getSubscription(sub.email);
  if (existing?.performance_rate != null) return { ...sub, performance_rate: existing.performance_rate };
  const { left } = await foundingStatus();
  return { ...sub, performance_rate: left > 0 ? FOUNDING_RATE : STANDARD_RATE };
}
