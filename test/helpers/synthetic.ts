import { trainSalesModel } from "@/lib/model";
import { measureProof } from "@/lib/proof";
import type { CampaignDay, DailySales, ParsedSalesSummary } from "@/lib/types";

// The synthetic restaurants behind every accuracy claim Swell makes.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
const DOW = [300, -600, -200, 0, 150, 500, 900];
export const iso = (t: number) => new Date(Date.UTC(2026, 0, 5 + t)).toISOString().slice(0, 10);
export function series(from: number, n: number, sd: number, trend: number, seed: number, lift = 0): DailySales[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const t = from + i;
    return { date: iso(t), net_sales: Math.round(3000 + trend * t + DOW[(1 + t) % 7] + lift + sd * gauss(r)), orders: 80 };
  });
}
const asSummary = (daily: DailySales[]) => ({ daily }) as unknown as ParsedSalesSummary;

/** Coverage of the 80%/95% ranges over each restaurant's true next 30 days. */
export function forecastEvidence(minHist: number, maxHist: number, restaurants: number, seed: number) {
  const r = rng(seed);
  let n = 0, in80 = 0, in95 = 0, beatNaive = 0;
  for (let k = 0; k < restaurants; k++) {
    const hist = minHist + Math.floor(r() * (maxHist - minHist));
    const sd = 100 + r() * 400;
    const trend = (r() - 0.5) * 12;
    const m = trainSalesModel(asSummary(series(0, hist, sd, trend, seed + k)))!;
    if (m.cv.skill > 0) beatNaive++;
    for (const d of series(hist, 30, sd, trend, seed + 5000 + k)) {
      n++;
      const a = m.predictInterval(d.date, 0.8);
      const b = m.predictInterval(d.date, 0.95);
      if (d.net_sales >= a.low && d.net_sales <= a.high) in80++;
      if (d.net_sales >= b.low && d.net_sales <= b.high) in95++;
    }
  }
  return { restaurants, days: n, cover80: in80 / n, cover95: in95 / n, beatNaive };
}

/** How often Proof says "proven" when the campaign did nothing at all. */
export function proofFalseAlarms(restaurants: number, seed: number) {
  let proven = 0, covered = 0;
  const days = Array.from({ length: 30 }, (_, i) => ({ date: iso(90 + i), item: "x", daypart: "Dinner", projected_revenue: 0 })) as unknown as CampaignDay[];
  for (let k = 0; k < restaurants; k++) {
    const model = trainSalesModel(asSummary(series(0, 90, 250, 0, seed + k)))!;
    const p = measureProof({ model, days, after: series(90, 30, 250, 0, seed + 900 + k), lines: [], campaignStart: iso(90) });
    if (p.verdict === "proven") proven++;
    if (p.low80 <= 0 && p.high80 >= 0) covered++;
  }
  return { restaurants, falseProven: proven, rangeCoveredZero: covered };
}
