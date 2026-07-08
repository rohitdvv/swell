import type { ParsedSalesSummary, MarketplaceSignals, Daypart, DayOfWeek } from "./types";
import { clamp } from "./utils";

/**
 * Project redemptions + incremental revenue for a single promo day.
 * Shared by the generator and the inline-edit endpoint so an edited
 * discount % recomputes exactly the way the brain first computed it.
 */
export function projectDay(
  sales: ParsedSalesSummary,
  marketplace: MarketplaceSignals,
  dowFullName: DayOfWeek,
  daypart: Daypart,
  pct: number
): { projected_redemptions: number; projected_revenue: number; reachable: number } {
  const totalOrders = sales.order_count || 1;
  const dataDays = Math.max(sales.date_range.days, 14);
  const dowOccurrences = Math.max(1, Math.round(dataDays / 7));

  const dpOrders = sales.by_daypart[daypart]?.orders ?? 0;
  const dpShare = dpOrders / totalOrders;
  const dowOrdersPerOccurrence = (sales.by_dayofweek[dowFullName]?.orders ?? 0) / dowOccurrences;
  const reachable = Math.max(2, dowOrdersPerOccurrence * dpShare);

  const responseRate = clamp(0.12 + (pct / 100) * 0.7, 0.1, 0.55);
  const projected_redemptions = Math.max(
    3,
    Math.round(reachable * responseRate * marketplace.lift_factor)
  );
  const avgCheck = sales.by_dayofweek[dowFullName]?.avg_check || 42;
  const discountedCheck = avgCheck * (1 - pct / 100);
  const projected_revenue = Math.round(projected_redemptions * discountedCheck * 0.55);

  return { projected_redemptions, projected_revenue, reachable };
}
