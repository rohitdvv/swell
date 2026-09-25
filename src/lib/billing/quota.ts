import { PLANS, type Plan } from "./plans";
import type { Subscription } from "../types";

// ============================================================
// Entitlements. Every signed-in account can build campaigns: no plan means
// the Free tier. Limits are enforced on the server (api/generate), not just
// in the console UI.
//
// Regenerating a campaign you already own replaces it, so it never counts
// against the monthly allowance — owners can iterate freely.
// ============================================================

export type Limits = Plan["limits"];

export const FREE_LIMITS: Limits = {
  restaurants: 1,
  campaignsPerMonth: 1,
  adKit: false,
  autoPublish: false,
  whiteLabel: false,
};

export type Tier = { id: "free" | Plan["id"]; name: string; limits: Limits };

export function isPaying(sub: Subscription | null): boolean {
  return !!sub && (sub.status === "active" || sub.status === "trialing");
}

export function tierFor(sub: Subscription | null): Tier {
  if (!isPaying(sub)) return { id: "free", name: "Free", limits: FREE_LIMITS };
  const plan = PLANS[sub!.plan];
  return { id: plan.id, name: plan.name, limits: plan.limits };
}

export type OwnedCampaign = { slug: string; restaurant_slug: string; created_at: string };

export type Usage = { campaignsThisMonth: number; restaurants: number };

const monthOf = (iso: string) => iso.slice(0, 7);

export function usageOf(owned: OwnedCampaign[], now = new Date()): Usage {
  const month = now.toISOString().slice(0, 7);
  return {
    campaignsThisMonth: owned.filter((c) => monthOf(c.created_at) === month).length,
    restaurants: new Set(owned.map((c) => c.restaurant_slug)).size,
  };
}

export type Decision = { ok: true } | { ok: false; reason: "campaigns" | "restaurants"; message: string };

/** May this owner save `next`? */
export function canCreate(
  tier: Tier,
  owned: OwnedCampaign[],
  next: { slug: string; restaurant_slug: string },
  now = new Date()
): Decision {
  // Regenerating an existing campaign replaces it — always allowed.
  if (owned.some((c) => c.slug === next.slug)) return { ok: true };

  const { campaignsPerMonth, restaurants } = tier.limits;
  const usage = usageOf(owned, now);
  const knownRestaurant = owned.some((c) => c.restaurant_slug === next.restaurant_slug);

  if (restaurants !== -1 && !knownRestaurant && usage.restaurants >= restaurants) {
    return {
      ok: false,
      reason: "restaurants",
      message: `Your ${tier.name} plan covers ${restaurants} restaurant${restaurants === 1 ? "" : "s"}. Upgrade to add another.`,
    };
  }
  if (campaignsPerMonth !== -1 && usage.campaignsThisMonth >= campaignsPerMonth) {
    return {
      ok: false,
      reason: "campaigns",
      message: `You've used ${usage.campaignsThisMonth} of ${campaignsPerMonth} campaign${
        campaignsPerMonth === 1 ? "" : "s"
      } this month on the ${tier.name} plan. Regenerate an existing one, or upgrade for more.`,
    };
  }
  return { ok: true };
}
