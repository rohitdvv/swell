import { describe, it, expect } from "vitest";
import { planStaffing, DAYPART_HOURS } from "@/lib/staffing";
import type { SalesModel } from "@/lib/model";
import type { CampaignDay, ParsedSalesSummary } from "@/lib/types";

// A fixed forecast: weekends busy, Monday quiet. High end = +20%.
const EXPECT: Record<number, number> = { 0: 9000, 1: 5000, 2: 6000, 3: 6500, 4: 7000, 5: 10000, 6: 11000 };
const model = {
  predictInterval: (iso: string) => {
    const e = EXPECT[new Date(iso + "T00:00:00Z").getUTCDay()];
    return { low: e * 0.8, high: e * 1.2 };
  },
} as unknown as SalesModel;

const sales = {
  by_daypart: {
    Breakfast: { net_sales: 100, orders: 2 }, // under 3% → closed
    Lunch: { net_sales: 30_000, orders: 700 },
    Afternoon: { net_sales: 10_000, orders: 200 },
    Dinner: { net_sales: 50_000, orders: 900 },
    "Late-Night": { net_sales: 9_900, orders: 150 },
  },
  by_dayofweek: new Proxy({}, { get: () => ({ avg_check: 50 }) }),
} as unknown as ParsedSalesSummary;

const days = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 9, 5 + i)).toISOString().slice(0, 10), // starts Monday
  dow: "Monday",
  daypart: "Afternoon",
  pct_off: 20,
  projected_redemptions: i === 0 ? 40 : 0,
})) as unknown as CampaignDay[];

describe("staffing from the forecast", () => {
  const plan = planStaffing({ model, sales, days });

  it("skips dayparts the restaurant barely trades in", () => {
    expect(plan.open).toEqual(["Lunch", "Afternoon", "Dinner", "Late-Night"]);
  });

  it("staffs to the high end of the range: hours = sales ÷ SPLH", () => {
    const sat = plan.days.find((d) => new Date(d.date + "T00:00:00Z").getUTCDay() === 6)!;
    const dinner = sat.dayparts.find((x) => x.daypart === "Dinner")!;
    // 11,000 × 1.2 × (50,000 / 99,900) ≈ 6,607 sales → ÷ $55 ≈ 120 h
    expect(dinner.sales).toBeCloseTo(11_000 * 1.2 * (50_000 / 99_900), -1);
    expect(dinner.hours).toBeCloseTo(dinner.sales / 55, 0);
  });

  it("never drops below a minimum crew for the hours a daypart is open", () => {
    for (const d of plan.days) for (const x of d.dayparts) expect(x.hours).toBeGreaterThanOrEqual(2 * DAYPART_HOURS[x.daypart] - 0.05);
  });

  it("adds hours for the guests a promo brings in", () => {
    const withPromo = plan.days[0].dayparts.find((x) => x.daypart === "Afternoon")!;
    const nextMonday = plan.days[7].dayparts.find((x) => x.daypart === "Afternoon")!;
    // 40 redemptions × $50 × 0.8 = $1,600 extra afternoon sales
    expect(withPromo.sales - nextMonday.sales).toBeCloseTo(1600, -1);
  });

  it("finds the quiet-day hours a flat schedule wastes, and the busy-day hours it lacks", () => {
    expect(plan.trimHours).toBeGreaterThan(0);
    expect(plan.addHours).toBeGreaterThan(0);
    expect(plan.trimValue).toBe(Math.round(plan.trimHours * 18));
    // Hours balance: what a flat schedule over-staffs equals what it under-staffs.
    expect(Math.abs(plan.trimHours - plan.addHours)).toBeLessThan(1); // per-day 0.1 h rounding
  });

  it("responds to the owner's own assumptions", () => {
    const lean = planStaffing({ model, sales, days, assumptions: { splh: 80 } });
    expect(lean.totalHours).toBeLessThan(plan.totalHours);
  });
});
