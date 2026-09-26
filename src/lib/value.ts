// ============================================================
// What the projection is worth to the owner — in profit, not revenue.
//
// Restaurants keep ~3–6% of revenue. Slow-hour sales are different: the
// staff, rent and lights are already paid for, so most of each extra dollar
// (after food cost) falls to profit. A "small" revenue lift is therefore a
// large share of the year's profit. Every constant is shown in the UI as an
// assumption, never presented as measured.
// ============================================================

/** Share of an incremental slow-hour dollar kept after food + packaging. */
export const FLOW_THROUGH = 0.6;
/** Typical full-service restaurant net margin (industry range 3–6%). */
export const TYPICAL_NET_MARGIN = 0.05;

export type Value = {
  profitPerMonth: number;
  profitPerYear: number;
  /** Annual profit of a typical restaurant at this revenue. */
  typicalAnnualProfit: number;
  /** profitPerYear as a share of typicalAnnualProfit (0.34 = +34%). */
  profitShare: number;
  /** Return on the plan price, per month. */
  roiMultiple: number | null;
};

export function valueOf(monthlyLift: number, monthlyRevenue: number, planPricePerMonth: number | null): Value {
  const profitPerMonth = Math.max(0, monthlyLift) * FLOW_THROUGH;
  const profitPerYear = profitPerMonth * 12;
  const typicalAnnualProfit = Math.max(0, monthlyRevenue) * 12 * TYPICAL_NET_MARGIN;
  return {
    profitPerMonth: Math.round(profitPerMonth),
    profitPerYear: Math.round(profitPerYear),
    typicalAnnualProfit: Math.round(typicalAnnualProfit),
    profitShare: typicalAnnualProfit > 0 ? profitPerYear / typicalAnnualProfit : 0,
    roiMultiple: planPricePerMonth && planPricePerMonth > 0 ? profitPerMonth / planPricePerMonth : null,
  };
}
