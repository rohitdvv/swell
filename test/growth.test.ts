import { describe, it, expect } from "vitest";
import { useTempDb } from "./helpers/temp-db";

useTempDb("growth");

const { repo } = await import("@/lib/db");
const { withPerformanceRate, foundingStatus, FOUNDING_LIMIT } = await import("@/lib/billing/founding");
const { settleProof } = await import("@/lib/billing/settle");
import type { Subscription } from "@/lib/types";
import type { ProofReport } from "@/lib/proof";

const perf = (email: string): Subscription => ({
  email, plan: "performance", interval: "monthly", status: "active", mode: "demo",
  current_period_end: null, stripe_customer_id: null, stripe_subscription_id: null,
});

describe("founding 100", () => {
  it("gives the first accounts 10% and locks it for life", async () => {
    await repo.upsertSubscription(await withPerformanceRate(perf("first@x.com")));
    expect((await repo.getSubscription("first@x.com"))!.performance_rate).toBe(0.1);
    // Re-activating later (e.g. after the cap is reached) never changes a granted rate.
    await repo.upsertSubscription({ ...perf("first@x.com"), performance_rate: 0.15 });
    expect((await repo.getSubscription("first@x.com"))!.performance_rate).toBe(0.1);
  });

  it("bills a founding account at its locked 10%", async () => {
    const c = await settleProof({ id: "f1", slug: "f1", restaurant_name: "F" }, { verdict: "proven", low80: 4000, days_covered: 30 } as ProofReport, "first@x.com");
    expect(c).toMatchObject({ amount: 400, rate: 0.1 });
  });

  it("closes at the limit — the counter is real", async () => {
    for (let i = 2; i <= FOUNDING_LIMIT; i++) await repo.upsertSubscription(await withPerformanceRate(perf(`f${i}@x.com`)));
    expect(await foundingStatus()).toMatchObject({ taken: FOUNDING_LIMIT, left: 0 });
    await repo.upsertSubscription(await withPerformanceRate(perf("late@x.com")));
    expect((await repo.getSubscription("late@x.com"))!.performance_rate).toBe(0.15);
  }, 60_000);
});

describe("founder dashboard + leads", () => {
  it("stores leads and reports the funnel", async () => {
    await repo.addLead({ email: "Owner@Grill.com", name: null, phone: "512-555-0100", restaurant: "Main Street Grill", source: "audit", note: null, found_per_month: 13678 });
    const leads = await repo.listLeads();
    expect(leads[0]).toMatchObject({ email: "owner@grill.com", restaurant: "Main Street Grill", found_per_month: 13678 });
    const s = await repo.adminStats();
    expect(s.performance).toBe(FOUNDING_LIMIT + 1);
    expect(s.leads).toBe(1);
  });
});
