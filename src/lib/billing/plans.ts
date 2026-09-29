// ============================================================
// Swell — subscription plans
// Prices are in USD/month. Annual billing = 2 months free (×10).
// Stripe Price IDs are read from env when running against real Stripe.
// ============================================================

export type PlanId = "starter" | "pro" | "agency" | "performance";
export type Interval = "monthly" | "annual";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number;
  annual: number; // per-year price
  popular?: boolean;
  limits: {
    restaurants: number; // -1 = unlimited
    campaignsPerMonth: number; // -1 = unlimited
    adKit: boolean;
    autoPublish: boolean;
    whiteLabel: boolean;
  };
  features: string[];
  priceIds: { monthly?: string; annual?: string };
  /** Pay-for-proof plans: no subscription fee, a share of proven lift instead. */
  performance?: { rate: number; monthlyCap: number };
};

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "For the single owner-operator.",
    monthly: 49,
    annual: 490,
    limits: {
      restaurants: 1,
      campaignsPerMonth: 3,
      adKit: false,
      autoPublish: false,
      whiteLabel: false,
    },
    features: [
      "1 restaurant",
      "3 campaigns / month",
      "Real-time weather + events brain",
      "Auto-branded daily posters",
      "Shareable public campaign URL",
    ],
    priceIds: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
      annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For growing multi-shift venues.",
    monthly: 149,
    annual: 1490,
    popular: true,
    limits: {
      restaurants: 10,
      campaignsPerMonth: -1,
      adKit: true,
      autoPublish: true,
      whiteLabel: false,
    },
    features: [
      "Up to 10 restaurants",
      "Unlimited campaigns",
      "Everything in Starter, plus:",
      "Ad Kit — Meta & Google-ready assets",
      "Connect & auto-publish to ad platforms",
      "Priority poster rendering",
    ],
    priceIds: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
    },
  },
  agency: {
    id: "agency",
    name: "Agency",
    tagline: "For groups & hospitality agencies.",
    monthly: 399,
    annual: 3990,
    limits: {
      restaurants: -1,
      campaignsPerMonth: -1,
      adKit: true,
      autoPublish: true,
      whiteLabel: true,
    },
    features: [
      "Unlimited restaurants",
      "Unlimited campaigns",
      "Everything in Pro, plus:",
      "White-label campaign artifacts",
      "Team seats & client workspaces",
      "Dedicated onboarding",
    ],
    priceIds: {
      monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY,
      annual: process.env.STRIPE_PRICE_AGENCY_ANNUAL,
    },
  },
  performance: {
    id: "performance",
    name: "Pay for proof",
    tagline: "No lift, no bill.",
    monthly: 0,
    annual: 0,
    limits: {
      restaurants: 3,
      campaignsPerMonth: -1,
      adKit: true,
      autoPublish: false,
      whiteLabel: false,
    },
    features: [
      "$0 a month — no subscription",
      "15% of lift your register proves, billed on the cautious end of the range",
      "Capped at $1,500 a month per account",
      "Nothing billed for 'promising', 'no lift' or 'too early'",
      "Up to 3 restaurants, unlimited campaigns, Ad Kit",
    ],
    priceIds: {},
    performance: { rate: 0.15, monthlyCap: 1500 },
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "pro", "agency"];

export function planPrice(plan: Plan, interval: Interval): number {
  return interval === "annual" ? plan.annual : plan.monthly;
}

/** Effective monthly cost for display ("$124/mo billed annually"). */
export function monthlyEquivalent(plan: Plan, interval: Interval): number {
  return interval === "annual" ? Math.round(plan.annual / 12) : plan.monthly;
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
