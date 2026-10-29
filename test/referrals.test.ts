import { describe, it, expect } from "vitest";
import { useTempDb } from "./helpers/temp-db";

useTempDb("referrals");

const { repo } = await import("@/lib/db");
const { rewardReferralIfEarned, applyCredit, REFERRAL_CREDIT, REFERRAL_CODE } = await import("@/lib/billing/referrals");
const { settleProof } = await import("@/lib/billing/settle");
import type { ProofReport } from "@/lib/proof";

const proof = (verdict: ProofReport["verdict"], days: number, low80 = 4000) => ({ verdict, days_covered: days, low80 }) as ProofReport;
const user = (email: string) => repo.createUser({ email, name: email.split("@")[0], password_hash: "clerk" });

describe("referral links", () => {
  it("gives every account one stable, readable code", async () => {
    await user("ann@grill.com");
    const code = await repo.ensureReferralCode("ann@grill.com");
    expect(code).toMatch(REFERRAL_CODE);
    expect(await repo.ensureReferralCode("ann@grill.com")).toBe(code);
    expect(await repo.userByReferralCode(code.toUpperCase())).toBe("ann@grill.com");
  });

  it("attributes a new account once, and never to itself", async () => {
    await user("bo@taqueria.com");
    await repo.setReferredBy("bo@taqueria.com", "ann@grill.com");
    await repo.setReferredBy("bo@taqueria.com", "someone@else.com"); // first referrer wins
    expect(await repo.referrerOf("bo@taqueria.com")).toBe("ann@grill.com");
    await repo.setReferredBy("ann@grill.com", "ann@grill.com");
    expect(await repo.referrerOf("ann@grill.com")).toBeNull();
  });
});

describe("rewards are earned by results, not sign-ups", () => {
  it("pays nothing for sign-ups, promising results or unfinished campaigns", async () => {
    expect(await rewardReferralIfEarned("bo@taqueria.com", proof("promising", 30), "c0")).toBe(false);
    expect(await rewardReferralIfEarned("bo@taqueria.com", proof("proven", 14), "c0")).toBe(false);
    expect(await repo.creditBalance("ann@grill.com")).toBe(0);
  });

  it("credits both sides once when the referred register proves a full campaign", async () => {
    expect(await rewardReferralIfEarned("bo@taqueria.com", proof("proven", 30), "c1")).toBe(true);
    expect(await rewardReferralIfEarned("bo@taqueria.com", proof("proven", 30), "c2")).toBe(false); // once, ever
    expect(await repo.creditBalance("ann@grill.com")).toBe(REFERRAL_CREDIT);
    expect(await repo.creditBalance("bo@taqueria.com")).toBe(REFERRAL_CREDIT);
    expect(await repo.referralStats("ann@grill.com")).toEqual({ signedUp: 1, proven: 1, earned: REFERRAL_CREDIT });
  });

  it("a non-referred account never earns anything", async () => {
    expect(await rewardReferralIfEarned("ann@grill.com", proof("proven", 30), "c3")).toBe(false);
  });
});

describe("credits come off pay-for-proof fees", () => {
  it("applies once per campaign, even if invoicing is retried", async () => {
    expect(await applyCredit("bo@taqueria.com", "camp-x", 600)).toBe(100);
    expect(await applyCredit("bo@taqueria.com", "camp-x", 600)).toBe(100); // retry: same, no second debit
    expect(await repo.creditBalance("bo@taqueria.com")).toBe(0);
  });

  it("nets the fee on a real settlement, and covers it fully when credit is larger", async () => {
    await repo.upsertSubscription({
      email: "ann@grill.com", plan: "performance", interval: "monthly", status: "active", mode: "demo",
      current_period_end: null, stripe_customer_id: null, stripe_subscription_id: null, performance_rate: 0.1,
    });
    // $1,000 proven at 10% = $100 fee; Ann has $100 credit → fully covered.
    const covered = await settleProof({ id: "a1", slug: "a1", restaurant_name: "Ann's" }, proof("proven", 30, 1000), "ann@grill.com");
    expect(covered).toMatchObject({ amount: 0, status: "credited" });
    // No credit left: the next proven campaign is billed in full.
    const billed = await settleProof({ id: "a2", slug: "a2", restaurant_name: "Ann's" }, proof("proven", 30, 4000), "ann@grill.com");
    expect(billed).toMatchObject({ amount: 400, status: "demo" });
  });
});
