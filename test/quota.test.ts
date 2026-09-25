import { describe, it, expect } from "vitest";
import { tierFor, canCreate, usageOf, FREE_LIMITS, type OwnedCampaign } from "@/lib/billing/quota";
import type { Subscription } from "@/lib/types";

const NOW = new Date("2026-09-25T12:00:00Z");
const sub = (plan: Subscription["plan"], status: Subscription["status"] = "active") =>
  ({ email: "a@b.com", plan, status, interval: "monthly", mode: "demo" }) as Subscription;
const owned = (slug: string, restaurant: string, created = "2026-09-10T00:00:00Z"): OwnedCampaign => ({
  slug,
  restaurant_slug: restaurant,
  created_at: created,
});

describe("tiers", () => {
  it("no plan, or a lapsed plan, is the Free tier — never a paywall", () => {
    expect(tierFor(null).id).toBe("free");
    expect(tierFor(sub("pro", "canceled")).id).toBe("free");
    expect(tierFor(sub("pro", "past_due")).limits).toEqual(FREE_LIMITS);
  });
  it("active and trialing plans get their plan's limits", () => {
    expect(tierFor(sub("starter")).limits.campaignsPerMonth).toBe(3);
    expect(tierFor(sub("pro", "trialing")).limits.campaignsPerMonth).toBe(-1);
  });
});

describe("free tier", () => {
  const free = tierFor(null);

  it("a brand-new account can build its first campaign", () => {
    expect(canCreate(free, [], { slug: "osteria-lume-sep", restaurant_slug: "osteria-lume" }, NOW).ok).toBe(true);
  });

  it("regenerating the campaign you own is always free", () => {
    const mine = [owned("osteria-lume-sep", "osteria-lume")];
    expect(canCreate(free, mine, { slug: "osteria-lume-sep", restaurant_slug: "osteria-lume" }, NOW).ok).toBe(true);
  });

  it("a second restaurant needs a plan", () => {
    const mine = [owned("osteria-lume-sep", "osteria-lume")];
    const d = canCreate(free, mine, { slug: "taco-bar-sep", restaurant_slug: "taco-bar" }, NOW);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("restaurants");
  });

  it("a second campaign this month needs a plan; next month resets", () => {
    const mine = [owned("osteria-lume-sep", "osteria-lume")];
    const d = canCreate(free, mine, { slug: "osteria-lume-sep-2", restaurant_slug: "osteria-lume" }, NOW);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.message).toMatch(/1 of 1 campaign/);
    const october = new Date("2026-10-02T00:00:00Z");
    expect(canCreate(free, mine, { slug: "osteria-lume-oct", restaurant_slug: "osteria-lume" }, october).ok).toBe(true);
  });
});

describe("paid tiers", () => {
  it("Starter allows 3 a month for one restaurant", () => {
    const starter = tierFor(sub("starter"));
    const mine = [owned("a-1", "a"), owned("a-2", "a"), owned("a-3", "a")];
    expect(canCreate(starter, mine.slice(0, 2), { slug: "a-3", restaurant_slug: "a" }, NOW).ok).toBe(true);
    expect(canCreate(starter, mine, { slug: "a-4", restaurant_slug: "a" }, NOW).ok).toBe(false);
  });
  it("Agency is unlimited", () => {
    const agency = tierFor(sub("agency"));
    const mine = Array.from({ length: 40 }, (_, i) => owned(`r${i}`, `r${i}`));
    expect(canCreate(agency, mine, { slug: "new", restaurant_slug: "new" }, NOW).ok).toBe(true);
  });
});

it("usage counts only this month's campaigns and distinct restaurants", () => {
  const u = usageOf([owned("a", "x"), owned("b", "x"), owned("c", "y", "2026-08-01T00:00:00Z")], NOW);
  expect(u).toEqual({ campaignsThisMonth: 2, restaurants: 2 });
});
