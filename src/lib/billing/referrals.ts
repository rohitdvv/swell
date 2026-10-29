import "server-only";
import { repo } from "@/lib/db";
import { BILLABLE_AFTER_DAYS } from "./performance";
import type { ProofReport } from "../proof";

// ============================================================
// Referrals — "Give $100, get $100, when their register proves it."
//
// A referred restaurant is attributed when its account is first created
// (cookie set by /r/[code]). The reward is earned only when THAT restaurant's
// own register proves a full campaign worked — not on sign-up — so fake
// accounts earn nothing and every reward we pay for created real value.
// Both sides get the credit; it comes off pay-for-proof fees automatically.
// ============================================================

export const REFERRAL_CREDIT = 100;
export const REFERRAL_COOKIE = "swell_ref";
export const REFERRAL_CODE = /^[a-z2-9]{7}$/;

/** Called after every Proof upload. Returns true when this upload earned the reward. */
export async function rewardReferralIfEarned(email: string, proof: ProofReport, campaignId: string): Promise<boolean> {
  if (proof.verdict !== "proven" || proof.days_covered < BILLABLE_AFTER_DAYS) return false;
  const referrer = await repo.referrerOf(email);
  if (!referrer || referrer === email) return false;
  return repo.rewardReferral(email, referrer, REFERRAL_CREDIT, campaignId);
}

/**
 * Credit to take off a final fee for `campaignId`. Idempotent: the first call
 * debits the ledger once; any retry (e.g. after a failed invoice) returns the
 * same amount without debiting again.
 */
export async function applyCredit(email: string, campaignId: string, fee: number): Promise<number> {
  const already = await repo.creditApplied(email, campaignId);
  if (already > 0) return Math.min(already, fee);
  const use = Math.min(Math.max(0, await repo.creditBalance(email)), fee);
  if (use <= 0) return 0;
  await repo.addCredit(email, -use, `Applied to campaign ${campaignId}`, `apply:${campaignId}`);
  return use;
}
