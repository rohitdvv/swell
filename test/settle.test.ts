import { describe, it, expect, vi } from "vitest";

// A throwaway embedded Postgres (PGlite) — never the developer's data.
// (vi.hoisted runs before imports, so no fs here; db.ts creates the dir.)
vi.hoisted(() => {
  process.env.SWELL_DATA_DIR = `${process.env.TMPDIR ?? "/tmp"}/swell-settle-${process.pid}-${Date.now()}`;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.STRIPE_SECRET_KEY;
});

const { repo } = await import("@/lib/db");
const { settleProof } = await import("@/lib/billing/settle");
import type { ProofReport } from "@/lib/proof";

const proof = (low80: number, days: number, verdict: ProofReport["verdict"] = "proven") =>
  ({ verdict, low80, days_covered: days }) as ProofReport;
const camp = (id: string) => ({ id, slug: `slug-${id}`, restaurant_name: `R ${id}` });

async function subscribe(email: string, plan: "performance" | "starter") {
  await repo.upsertSubscription({
    email, plan, interval: "monthly", status: "active", mode: "demo",
    current_period_end: null, stripe_customer_id: null, stripe_subscription_id: null,
  });
}

describe("pay-for-proof settlement", () => {
  it("never charges accounts on other plans", async () => {
    await subscribe("starter@x.com", "starter");
    expect(await settleProof(camp("s1"), proof(5000, 30), "starter@x.com")).toBeNull();
  });

  it("estimates mid-campaign, finalises once, then freezes", async () => {
    await subscribe("p@x.com", "performance");
    const mid = await settleProof(camp("c1"), proof(4000, 14), "p@x.com");
    expect(mid).toMatchObject({ status: "estimate", amount: 600 });

    const done = await settleProof(camp("c1"), proof(5000, 30), "p@x.com");
    expect(done).toMatchObject({ status: "demo", amount: 750 });

    // A later, bigger re-measure must not re-bill or change a final charge.
    const again = await settleProof(camp("c1"), proof(9000, 30), "p@x.com");
    expect(again).toMatchObject({ status: "demo", amount: 750 });
    expect((await repo.listCharges("p@x.com")).length).toBe(1);
  });

  it("records 'not proven' at $0", async () => {
    const c = await settleProof(camp("c2"), proof(2000, 30, "promising"), "p@x.com");
    expect(c).toMatchObject({ status: "none", amount: 0 });
  });

  it("applies the monthly cap across campaigns", async () => {
    // $750 already billed this month; cap $1,500 → at most $750 more.
    const c = await settleProof(camp("c3"), proof(20_000, 30), "p@x.com");
    expect(c).toMatchObject({ status: "demo", amount: 750 });
    const d = await settleProof(camp("c4"), proof(20_000, 30), "p@x.com");
    expect(d).toMatchObject({ status: "none", amount: 0 });
  });
});
