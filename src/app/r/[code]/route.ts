import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { REFERRAL_COOKIE, REFERRAL_CODE } from "@/lib/billing/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A referral link. Remembers who invited this visitor for 90 days, then
 * lands them on the free audit — the fastest way to see what Swell is worth.
 * Unknown codes still land on the audit, just without the invite.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toLowerCase();
  const valid = REFERRAL_CODE.test(code) && !!(await repo.userByReferralCode(code).catch(() => null));
  const res = NextResponse.redirect(new URL(valid ? "/audit?invited=1" : "/audit", request.url));
  if (valid) {
    res.cookies.set(REFERRAL_COOKIE, code, {
      maxAge: 90 * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return res;
}
