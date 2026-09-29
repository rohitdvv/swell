import type { ProofReport } from "../proof";

// ============================================================
// Pay-for-proof pricing. The fee is a share of the CAUTIOUS end of the
// measured lift (the bottom of Proof's 80% range), only when the verdict is
// "proven", and only once the campaign has fully run. Capped per month.
// Pure — unit-tested in test/performance.test.ts.
// ============================================================

/** Days of campaign data before a charge can be invoiced (a campaign is 30). */
export const BILLABLE_AFTER_DAYS = 28;

export type Fee = {
  /** Whole dollars. */
  amount: number;
  /** The lift figure the fee was computed from (cautious end of the range). */
  basis: number;
  billable: boolean;
  /** Invoice now, or keep as an estimate until the campaign has fully run. */
  final: boolean;
  reason: string;
};

export function performanceFee(
  proof: Pick<ProofReport, "verdict" | "low80" | "days_covered">,
  rate: number,
  monthlyCap: number,
  alreadyBilledThisMonth = 0
): Fee {
  if (proof.verdict !== "proven" || proof.low80 <= 0) {
    return { amount: 0, basis: 0, billable: false, final: false, reason: "Not proven — nothing to bill." };
  }
  const raw = Math.round(proof.low80 * rate);
  const room = Math.max(0, monthlyCap - alreadyBilledThisMonth);
  const amount = Math.min(raw, room);
  const final = proof.days_covered >= BILLABLE_AFTER_DAYS;
  return {
    amount,
    basis: proof.low80,
    billable: amount > 0,
    final,
    reason:
      amount < raw
        ? `${Math.round(rate * 100)}% of $${proof.low80.toLocaleString()} proven, capped at $${monthlyCap.toLocaleString()} a month.`
        : `${Math.round(rate * 100)}% of $${proof.low80.toLocaleString()} — the cautious end of the proven range.`,
  };
}
