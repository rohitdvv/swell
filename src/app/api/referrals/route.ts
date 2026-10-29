import { NextResponse } from "next/server";
import { getAccount } from "@/lib/billing/account";
import { repo } from "@/lib/db";
import { REFERRAL_CREDIT } from "@/lib/billing/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in account's referral link, results and credit balance. */
export async function GET(request: Request) {
  const { email } = await getAccount(); // also creates the user row on first sight
  if (!email) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const [code, stats, balance] = await Promise.all([
    repo.ensureReferralCode(email),
    repo.referralStats(email),
    repo.creditBalance(email),
  ]);
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
  return NextResponse.json({
    code,
    link: `${base.replace(/\/$/, "")}/r/${code}`,
    reward: REFERRAL_CREDIT,
    ...stats,
    balance,
  });
}
