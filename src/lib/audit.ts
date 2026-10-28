import "server-only";
import { randomUUID } from "node:crypto";
import type { CampaignDay, ParsedSalesSummary } from "./types";
import { analyzeSales, buildDayPlan, assembleCampaign, defaultStartDate } from "./generator";
import { neutralBrandKit } from "./brand";
import { neutralSignals } from "./marketplace";
import { EMPTY_CONTEXT } from "./context";
import { validateProjection } from "./validate";
import { trainSalesModel } from "./model";
import { planStaffing, DEFAULT_STAFFING } from "./staffing";
import { valueOf, FLOW_THROUGH } from "./value";
import { measureProof, type ItemLine, type ProofReport } from "./proof";
import { addDays } from "./utils";

// ============================================================
// The free audit — Swell's front door. No account, nothing stored: the
// export is analysed in memory and only the report leaves the server.
//
//   findMoney()     what this restaurant is leaving on the table: labor
//                   hours a flat schedule wastes + the slow-hour promotion
//                   opportunity, both as profit.
//   checkCampaign() did ANY marketing work — Swell's, a POS vendor's AI
//                   agent, an agency's, a flyer? Same counterfactual engine
//                   as Proof: trained only on sales before it started.
// ============================================================

export class AuditInputError extends Error {}

export type MoneyReport = {
  days: number;
  monthlyRevenue: number;
  model: { chosen: string; mae: number; mape: number; skill: number; coverage80: number | null } | null;
  slowest: string[];
  promo: { expected: number; low: number; high: number; confidence: string; profitPerMonth: number };
  staffing: { trimHours: number; trimValue: number; addHours: number; splh: number; wage: number } | null;
  totalPerMonth: number;
  perYear: number;
  shareOfTypicalProfit: number;
};

export function findMoney(sales: ParsedSalesSummary): MoneyReport {
  const startDate = defaultStartDate();
  const campaignId = randomUUID();
  const brand = neutralBrandKit(sales.restaurant_name);
  const avgBasket = sales.order_count > 0 ? sales.total_net_sales / sales.order_count : 42;
  const marketplace = neutralSignals(avgBasket);
  const analysis = analyzeSales(sales);
  const { rawDays, meta } = buildDayPlan(sales, brand, marketplace, analysis, EMPTY_CONTEXT, { startDate, campaignId });
  const days: CampaignDay[] = rawDays.map((d) => ({ ...d, copy: "", creative_url: "" }));
  const campaign = assembleCampaign(sales, brand, marketplace, days, meta, EMPTY_CONTEXT, {
    campaignId,
    restaurantId: campaignId,
    startDate,
  });
  const v = validateProjection({ ...campaign, days });

  const model = trainSalesModel(sales);
  const staff = model ? planStaffing({ model, sales, days: days.map((d) => ({ ...d, projected_redemptions: 0 })) }) : null;

  const promoProfit = Math.round(Math.max(0, v.expected) * FLOW_THROUGH);
  const staffingValue = staff?.trimValue ?? 0;
  const totalPerMonth = promoProfit + staffingValue;
  const value = valueOf(totalPerMonth / FLOW_THROUGH, v.baseline, null);

  const slowest = [...analysis.operating]
    .sort((a, b) => b.slowness - a.slowness)
    .slice(0, 3)
    .map((d) => d.daypart);

  return {
    days: sales.date_range.days,
    monthlyRevenue: v.baseline,
    model: model
      ? { chosen: model.chosen, mae: model.mae, mape: model.mape, skill: model.cv.skill, coverage80: model.interval.coverage80 }
      : null,
    slowest,
    promo: { expected: v.expected, low: v.low, high: v.high, confidence: v.confidence, profitPerMonth: promoProfit },
    staffing: staff
      ? { trimHours: staff.trimHours, trimValue: staff.trimValue, addHours: staff.addHours, splh: DEFAULT_STAFFING.splh, wage: DEFAULT_STAFFING.wage }
      : null,
    totalPerMonth,
    perYear: totalPerMonth * 12,
    shareOfTypicalProfit: value.profitShare,
  };
}

export type CampaignCheck = {
  proof: ProofReport;
  preDays: number;
  start: string;
  end: string;
  spend: { monthly: number; months: number; total: number; cautiousReturn: number | null } | null;
};

/**
 * Did a campaign that ran from `start` (to `end`, default: the export's last
 * day) lift sales? The model never sees a day on or after `start`.
 */
export function checkCampaign(input: {
  sales: ParsedSalesSummary;
  lines: ItemLine[];
  start: string;
  end?: string;
  monthlySpend?: number;
}): CampaignCheck {
  const daily = [...(input.sales.daily ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!daily.length) throw new AuditInputError("No daily sales found in this export.");
  const end = input.end && input.end >= input.start ? input.end : daily[daily.length - 1].date;
  const before = daily.filter((d) => d.date < input.start);
  const during = daily.filter((d) => d.date >= input.start && d.date <= end);
  if (before.length < 14) {
    throw new AuditInputError(
      `Need at least 14 days of sales before the campaign started — this export has ${before.length}. Export a longer range.`
    );
  }
  if (during.length === 0) throw new AuditInputError("This export has no sales between those dates.");

  const model = trainSalesModel({ ...input.sales, daily: before });
  if (!model) throw new AuditInputError("Not enough history before the campaign to build a baseline.");

  const days = during.map((d) => ({ date: d.date, item: "", daypart: "Dinner", projected_revenue: 0 })) as unknown as CampaignDay[];
  const proof = measureProof({ model, days, after: during, lines: [], campaignStart: input.start });

  let spend: CampaignCheck["spend"] = null;
  if (input.monthlySpend && input.monthlySpend > 0) {
    const months = Math.max(1, Math.round((during.length / 30) * 10) / 10);
    const total = Math.round(input.monthlySpend * months);
    // Profit the campaign provably produced (cautious end), per dollar spent.
    const cautiousProfit = Math.max(0, proof.low80) * FLOW_THROUGH;
    spend = {
      monthly: input.monthlySpend,
      months,
      total,
      cautiousReturn: total > 0 ? cautiousProfit / total : null,
    };
  }
  return { proof, preDays: before.length, start: input.start, end, spend };
}

/** A campaign start that leaves ≥14 days before it: the midpoint, for the UI's default. */
export function suggestStart(sales: ParsedSalesSummary): string | null {
  const daily = sales.daily ?? [];
  if (daily.length < 21) return null;
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  return addDays(sorted[0].date, Math.max(14, Math.floor(sorted.length * 0.6)));
}
