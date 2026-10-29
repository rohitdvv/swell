import { describe, it, expect } from "vitest";
import { useTempDb } from "./helpers/temp-db";

useTempDb("delete");

const { repo } = await import("@/lib/db");
const { analyzeSales, buildDayPlan, assembleCampaign } = await import("@/lib/generator");
const { neutralBrandKit } = await import("@/lib/brand");
const { neutralSignals } = await import("@/lib/marketplace");
const { EMPTY_CONTEXT } = await import("@/lib/context");
const { buildSampleCsv } = await import("@/lib/sample");
const { fileToRows, summarize } = await import("@/lib/csv");
import type { CampaignDay } from "@/lib/types";

async function makeCampaign(owner: string, name: string) {
  const sales = summarize(fileToRows(Buffer.from(buildSampleCsv(30).csv), "s.csv"), name);
  const brand = neutralBrandKit(name);
  const market = neutralSignals(40);
  const id = `camp-${name}`;
  const { rawDays, meta } = buildDayPlan(sales, brand, market, analyzeSales(sales), EMPTY_CONTEXT, { startDate: "2026-11-01", campaignId: id });
  const days: CampaignDay[] = rawDays.map((d) => ({ ...d, copy: "x", creative_url: "" }));
  const c = assembleCampaign(sales, brand, market, days, meta, EMPTY_CONTEXT, { campaignId: id, restaurantId: `r-${name}`, startDate: "2026-11-01" });
  c.owner_email = owner;
  await repo.upsertRestaurant({ id: c.restaurant_id, slug: c.restaurant_slug, name, sales });
  await repo.createCampaign(c, days);
  return c;
}

describe("account deletion", () => {
  it("erases the owner's data atomically and leaves everyone else's alone", async () => {
    await repo.createUser({ email: "gone@x.com", name: "Gone", password_hash: "clerk" });
    await repo.createUser({ email: "stay@x.com", name: "Stay", password_hash: "clerk" });
    const mine = await makeCampaign("gone@x.com", "Gone Grill");
    const theirs = await makeCampaign("stay@x.com", "Stay Cafe");
    await repo.upsertSubscription({ email: "gone@x.com", plan: "performance", interval: "monthly", status: "active", mode: "demo", current_period_end: null, stripe_customer_id: null, stripe_subscription_id: null });
    await repo.addCredit("gone@x.com", 100, "test", "t1");
    await repo.addLead({ email: "gone@x.com", name: null, phone: null, restaurant: null, source: "audit", note: null, found_per_month: null });
    await repo.upsertCharge({ campaign_id: "inv1", email: "gone@x.com", slug: "s", restaurant_name: "Gone Grill", basis: 4000, rate: 0.15, amount: 600, status: "invoiced", stripe_invoice_id: "in_1", reason: "r" });
    await repo.upsertCharge({ campaign_id: "est1", email: "gone@x.com", slug: "s", restaurant_name: "Gone Grill", basis: 4000, rate: 0.15, amount: 600, status: "estimate", stripe_invoice_id: null, reason: "r" });
    await repo.setReferredBy("stay@x.com", "gone@x.com");

    const r = await repo.deleteAccountData("Gone@X.com");
    expect(r.campaigns).toBe(1);

    expect(await repo.getCampaignBySlug(mine.slug)).toBeNull();
    expect(await repo.getUser("gone@x.com")).toBeNull();
    expect(await repo.getSubscription("gone@x.com")).toBeNull();
    expect(await repo.creditBalance("gone@x.com")).toBe(0);
    expect(await repo.listLeads()).toEqual([]);
    expect(await repo.listCharges("gone@x.com")).toEqual([]);
    // the financial record survives, anonymised
    const inv = await repo.getCharge("inv1");
    expect(inv).toMatchObject({ amount: 600, status: "invoiced", restaurant_name: "(deleted account)" });
    expect(inv!.email).toMatch(/^deleted:/);
    expect(await repo.getCharge("est1")).toBeNull();
    // everyone else is untouched, and no longer points at the deleted account
    expect(await repo.getCampaignBySlug(theirs.slug)).not.toBeNull();
    expect(await repo.getUser("stay@x.com")).not.toBeNull();
    expect(await repo.referrerOf("stay@x.com")).toBeNull();
  }, 60_000);
});
