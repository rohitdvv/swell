import { describe, it, expect } from "vitest";
import { measureProof, type ItemLine } from "@/lib/proof";
import { trainSalesModel } from "@/lib/model";
import type { CampaignDay, DailySales, ParsedSalesSummary } from "@/lib/types";

// Same synthetic restaurant as the model tests: base + weekday effect + noise.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
const DOW = [300, -600, -200, 0, 150, 500, 900];
const iso = (t: number) => new Date(Date.UTC(2026, 0, 5 + t)).toISOString().slice(0, 10);
function series(from: number, n: number, sd: number, seed: number, lift = 0): DailySales[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const t = from + i;
    return { date: iso(t), net_sales: Math.round(3000 + DOW[(1 + t) % 7] + lift + sd * gauss(r)), orders: 80 };
  });
}
const summary = (daily: DailySales[]) => ({ daily }) as unknown as ParsedSalesSummary;
const campaignDays = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    date: iso(from + i),
    item: "Cacio e Pepe",
    daypart: "Afternoon",
    projected_revenue: 90,
  })) as unknown as CampaignDay[];

describe("proof — measured lift vs the no-campaign counterfactual", () => {
  it("detects a real lift", () => {
    const model = trainSalesModel(summary(series(0, 90, 150, 1)))!;
    const after = series(90, 30, 150, 2, 400); // campaign adds ~$400/day
    const p = measureProof({ model, days: campaignDays(90, 30), after, lines: [], campaignStart: iso(90) });
    expect(p.days_covered).toBe(30);
    expect(p.verdict).toBe("proven");
    expect(p.lift).toBeGreaterThan(30 * 400 * 0.6);
    expect(p.low80).toBeGreaterThan(0);
  });

  it("does not cry 'proven' on noise — the 80% range covers zero ~80% of the time", () => {
    let covered = 0;
    let proven = 0;
    const N = 60;
    for (let k = 0; k < N; k++) {
      const model = trainSalesModel(summary(series(0, 90, 250, 100 + k)))!;
      const p = measureProof({
        model,
        days: campaignDays(90, 30),
        after: series(90, 30, 250, 900 + k), // no effect at all
        lines: [],
        campaignStart: iso(90),
      });
      if (p.low80 <= 0 && p.high80 >= 0) covered++;
      if (p.verdict === "proven") proven++;
    }
    expect(covered / N).toBeGreaterThan(0.68);
    // A false "proven" should be rare (one-sided ~10% by construction).
    expect(proven / N).toBeLessThan(0.2);
  });

  it("says 'too early' with under a week of campaign data", () => {
    const model = trainSalesModel(summary(series(0, 60, 150, 3)))!;
    const p = measureProof({ model, days: campaignDays(60, 30), after: series(60, 5, 150, 4, 400), lines: [], campaignStart: iso(60) });
    expect(p.days_covered).toBe(5);
    expect(p.verdict).toBe("too-early");
  });

  it("reads the promo dish inside its window against the same weekday before", () => {
    const model = trainSalesModel(summary(series(0, 60, 150, 5)))!;
    const lines: ItemLine[] = [];
    // Before the campaign: 4 per afternoon; during: 11. Other windows/items ignored.
    for (let t = 30; t < 60; t++) lines.push({ date: iso(t), daypart: "Afternoon", item: "Cacio e Pepe", qty: 4, net: 80 });
    for (let t = 60; t < 67; t++) {
      lines.push({ date: iso(t), daypart: "Afternoon", item: "cacio e pepe", qty: 11, net: 180 });
      lines.push({ date: iso(t), daypart: "Dinner", item: "Cacio e Pepe", qty: 50, net: 900 });
    }
    const p = measureProof({ model, days: campaignDays(60, 7), after: series(60, 7, 150, 6), lines, campaignStart: iso(60) });
    expect(p.windows.every((w) => w.sold === 11 && w.usual === 4)).toBe(true);
    expect(p.window_totals).toEqual({ days: 7, sold: 77, usual: 28 });
  });

  it("has no baseline to compare when the export starts at the campaign", () => {
    const model = trainSalesModel(summary(series(0, 60, 150, 7)))!;
    const lines: ItemLine[] = [{ date: iso(60), daypart: "Afternoon", item: "Cacio e Pepe", qty: 9, net: 150 }];
    const p = measureProof({ model, days: campaignDays(60, 7), after: series(60, 7, 150, 8), lines, campaignStart: iso(60) });
    expect(p.windows[0].usual).toBeNull();
    expect(p.window_totals).toBeNull();
  });
});
