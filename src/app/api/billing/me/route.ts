import { NextResponse } from "next/server";
import { getAccount } from "@/lib/billing/account";
import { repo } from "@/lib/db";
import { PLANS, stripeConfigured } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getAccount();
  const sub = account.subscription;
  const plan = sub ? PLANS[sub.plan] : null;
  const usedThisMonth = await repo.countCampaignsThisMonth();
  const limit = plan ? plan.limits.campaignsPerMonth : 0;

  return NextResponse.json({
    email: account.email,
    subscription: sub,
    plan,
    usage: { campaigns: usedThisMonth, limit },
    stripeConfigured: stripeConfigured(),
  });
}
