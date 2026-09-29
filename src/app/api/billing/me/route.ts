import { NextResponse } from "next/server";
import { getAccount } from "@/lib/billing/account";
import { repo } from "@/lib/db";
import { PLANS, stripeConfigured } from "@/lib/billing/plans";
import { tierFor, usageOf } from "@/lib/billing/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getAccount();
  const sub = account.subscription;
  const plan = sub ? PLANS[sub.plan] : null;
  const tier = tierFor(sub);
  // Usage is this account's own campaigns (it used to count every account's).
  const owned = account.email ? await repo.ownedCampaigns(account.email) : [];
  const usage = usageOf(owned);
  const user = account.email ? await repo.getUser(account.email) : null;
  const charges = account.email && sub?.plan === "performance" ? await repo.listCharges(account.email) : [];

  return NextResponse.json({
    email: account.email,
    user,
    subscription: sub,
    plan,
    tier,
    usage: {
      campaigns: usage.campaignsThisMonth,
      limit: tier.limits.campaignsPerMonth,
      restaurants: usage.restaurants,
      restaurantLimit: tier.limits.restaurants,
    },
    charges: charges.map((c) => ({
      slug: c.slug,
      restaurant: c.restaurant_name,
      amount: c.amount,
      status: c.status,
      reason: c.reason,
      date: c.updated_at,
    })),
    stripeConfigured: stripeConfigured(),
  });
}
