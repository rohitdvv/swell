import type { CampaignDay, Daypart, ParsedSalesSummary } from "./types";
import { DAYPARTS } from "./types";
import type { SalesModel } from "./model";

// ============================================================
// Staffing from the forecast. Labor is a restaurant's biggest controllable
// cost; the forecast already knows which days and dayparts will be quiet.
//
// Method (the industry-standard "sales per labor hour" rule):
//   labor hours = expected sales ÷ target sales-per-labor-hour, never below a
//   minimum crew for the hours a daypart is open.
// We staff to the HIGH end of the 80% range, plus the guests each promo is
// projected to bring in — so the plan rarely leaves a shift short-handed.
// Compared with a flat schedule (the same crew every day, sized for an
// average day), quiet days show hours you can trim and busy days hours you
// should add. Every constant is an owner-adjustable assumption.
// Pure functions — unit-tested in test/staffing.test.ts.
// ============================================================

export type StaffingAssumptions = {
  /** Target sales per labor hour. Full-service restaurants typically run $40–$70. */
  splh: number;
  /** Loaded hourly wage used to price hours. */
  wage: number;
  /** People on shift at minimum whenever a daypart is open. */
  minCrew: number;
};

export const DEFAULT_STAFFING: StaffingAssumptions = { splh: 55, wage: 18, minCrew: 2 };

/** Hours in each daypart window (see DAYPART_WINDOWS). */
export const DAYPART_HOURS: Record<Daypart, number> = {
  Breakfast: 3.5,
  Lunch: 3,
  Afternoon: 3,
  Dinner: 4,
  "Late-Night": 4,
};

/** A daypart with under 3% of sales is treated as closed. */
const OPEN_SHARE = 0.03;

export type StaffingDay = {
  date: string;
  dayparts: Array<{ daypart: Daypart; sales: number; hours: number }>;
  hours: number;
  flatHours: number;
};

export type StaffingPlan = {
  days: StaffingDay[];
  open: Daypart[];
  totalHours: number;
  flatHours: number;
  /** Hours a flat schedule would carry on quieter-than-average days. */
  trimHours: number;
  /** Hours a flat schedule would be short on busier-than-average days. */
  addHours: number;
  trimValue: number;
  assumptions: StaffingAssumptions;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

export function planStaffing(input: {
  model: SalesModel;
  sales: ParsedSalesSummary;
  days: CampaignDay[];
  assumptions?: Partial<StaffingAssumptions>;
}): StaffingPlan {
  const a = { ...DEFAULT_STAFFING, ...input.assumptions };
  const total = DAYPARTS.reduce((s, dp) => s + (input.sales.by_daypart[dp]?.net_sales ?? 0), 0) || 1;
  const share = Object.fromEntries(
    DAYPARTS.map((dp) => [dp, (input.sales.by_daypart[dp]?.net_sales ?? 0) / total])
  ) as Record<Daypart, number>;
  const open = DAYPARTS.filter((dp) => share[dp] >= OPEN_SHARE);
  const openShare = open.reduce((s, dp) => s + share[dp], 0) || 1;

  const hoursFor = (dp: Daypart, sales: number) =>
    Math.max(a.minCrew * DAYPART_HOURS[dp], sales / Math.max(1, a.splh));

  const sorted = [...input.days].sort((x, y) => x.date.localeCompare(y.date));
  const base = sorted.map((d) => {
    const high = input.model.predictInterval(d.date, 0.8).high;
    const avgCheck = input.sales.by_dayofweek[d.dow]?.avg_check || 40;
    const promoSales = d.projected_redemptions * avgCheck * (1 - d.pct_off / 100);
    const dayparts = open.map((dp) => {
      const sales = high * (share[dp] / openShare) + (dp === d.daypart ? promoSales : 0);
      return { daypart: dp, sales: Math.round(sales), hours: round1(hoursFor(dp, sales)) };
    });
    return { date: d.date, dayparts, hours: round1(dayparts.reduce((s, x) => s + x.hours, 0)) };
  });

  // A flat schedule: every day crewed like the average day of this plan.
  const flatHours = round1(base.reduce((s, d) => s + d.hours, 0) / Math.max(1, base.length));
  const days: StaffingDay[] = base.map((d) => ({ ...d, flatHours }));
  const trimHours = round1(days.reduce((s, d) => s + Math.max(0, d.flatHours - d.hours), 0));
  const addHours = round1(days.reduce((s, d) => s + Math.max(0, d.hours - d.flatHours), 0));

  return {
    days,
    open,
    totalHours: round1(days.reduce((s, d) => s + d.hours, 0)),
    flatHours,
    trimHours,
    addHours,
    trimValue: Math.round(trimHours * a.wage),
    assumptions: a,
  };
}
