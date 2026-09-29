import { describe, it, expect } from "vitest";
import { trainSalesModel, conformalQuantile, walkForwardFolds } from "@/lib/model";
import type { DailySales, ParsedSalesSummary } from "@/lib/types";

// ---- deterministic synthetic restaurant ---------------------------

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
function gaussian(r: () => number) {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Known truth: base + trend·t + weekday effect + N(0, sd). Day 0 = 2026-01-05 (a Monday). */
const DOW_EFFECT = [300, -600, -200, 0, 150, 500, 900]; // Sun..Sat
function truth(t: number, trendPerDay: number) {
  const dow = (1 + t) % 7; // t=0 is Monday (getUTCDay 1)
  return 3000 + trendPerDay * t + DOW_EFFECT[dow];
}
function iso(t: number) {
  const d = new Date(Date.UTC(2026, 0, 5 + t));
  return d.toISOString().slice(0, 10);
}
function series(n: number, opts: { trendPerDay?: number; sd?: number; seed?: number; from?: number } = {}) {
  const r = rng(opts.seed ?? 7);
  const out: DailySales[] = [];
  const from = opts.from ?? 0;
  for (let t = from; t < from + n; t++) {
    const y = truth(t, opts.trendPerDay ?? 0) + (opts.sd ?? 150) * gaussian(r);
    out.push({ date: iso(t), net_sales: Math.round(y), orders: 80 });
  }
  return out;
}
const summary = (daily: DailySales[]) => ({ daily }) as unknown as ParsedSalesSummary;

// ---- tests --------------------------------------------------------

describe("sales model — learns the real structure", () => {
  const m = trainSalesModel(summary(series(90, { trendPerDay: 4 })))!;

  it("finds the strongest and weakest weekday", () => {
    expect(m.strongestDow).toBe("Saturday");
    expect(m.weakestDow).toBe("Monday");
  });

  it("recovers the weekly trend (true +$28/week) within 25%", () => {
    expect(m.trendPerWeek).toBeGreaterThan(28 * 0.75);
    expect(m.trendPerWeek).toBeLessThan(28 * 1.25);
  });

  it("beats the seasonal-naive benchmark out of sample", () => {
    expect(m.cv.skill).toBeGreaterThan(0.1);
    expect(m.cv.mase).toBeLessThan(1);
  });

  it("reports every candidate so selection is auditable", () => {
    expect(m.cv.candidates.map((c) => c.name).sort()).toEqual(
      ["ridge-dow", "ridge-trend-dow", "seasonal-mean"].sort()
    );
    const chosen = m.cv.candidates.find((c) => c.name === m.chosen)!;
    const bestMae = Math.min(...m.cv.candidates.map((c) => c.mae));
    expect(chosen.mae).toBeLessThanOrEqual(bestMae * 1.02 + 1);
  });

  it("picks the trend model when the data genuinely trends", () => {
    expect(m.chosen).toBe("ridge-trend-dow");
  });
});

describe("sales model — honest uncertainty (conformal intervals)", () => {
  it("80% intervals cover ~80% of genuinely FUTURE days (out-of-time)", () => {
    const history = series(120, { trendPerDay: 2, sd: 200, seed: 11 });
    const m = trainSalesModel(summary(history))!;
    // 300 days the model never saw, drawn from the same process.
    const future = series(300, { trendPerDay: 2, sd: 200, seed: 99, from: 120 });
    const inside80 = future.filter((d) => {
      const iv = m.predictInterval(d.date, 0.8);
      return d.net_sales >= iv.low && d.net_sales <= iv.high;
    }).length;
    const inside95 = future.filter((d) => {
      const iv = m.predictInterval(d.date, 0.95);
      return d.net_sales >= iv.low && d.net_sales <= iv.high;
    }).length;
    expect(inside80 / future.length).toBeGreaterThan(0.7);
    expect(inside80 / future.length).toBeLessThan(0.93);
    expect(inside95 / future.length).toBeGreaterThan(0.87);
    expect(inside95).toBeGreaterThanOrEqual(inside80);
  });

  it("stays calibrated across 40 different restaurants over the 30-day campaign", () => {
    // Monte Carlo: vary history length, noise and trend. Pool every restaurant's
    // next-30-day outcomes. An honest "80%" must hold across businesses.
    const r = rng(2026);
    let n = 0;
    let in80 = 0;
    let in95 = 0;
    for (let k = 0; k < 40; k++) {
      const hist = 45 + Math.floor(r() * 60); // 45..104 days of history
      const sd = 100 + r() * 400; // quiet to very noisy
      const trendPerDay = (r() - 0.5) * 12; // -6..+6 $/day
      const m = trainSalesModel(summary(series(hist, { trendPerDay, sd, seed: 1000 + k })))!;
      const future = series(30, { trendPerDay, sd, seed: 5000 + k, from: hist });
      for (const d of future) {
        n++;
        const a = m.predictInterval(d.date, 0.8);
        const b = m.predictInterval(d.date, 0.95);
        if (d.net_sales >= a.low && d.net_sales <= a.high) in80++;
        if (d.net_sales >= b.low && d.net_sales <= b.high) in95++;
      }
    }
    // 1,200 genuinely future days. Allow modest conservatism, forbid overclaiming.
    expect(in80 / n).toBeGreaterThan(0.76);
    expect(in80 / n).toBeLessThan(0.95);
    expect(in95 / n).toBeGreaterThan(0.92);
  });

  it("stays honest with only 3–6 weeks of history (no overconfident 95% range)", () => {
    // Short exports are common. The old model's 95% range held only ~83% of
    // the time here; ranges must widen, not pretend.
    const r = rng(77);
    let n = 0;
    let in80 = 0;
    let in95 = 0;
    for (let k = 0; k < 60; k++) {
      const hist = 21 + Math.floor(r() * 24);
      const sd = 100 + r() * 400;
      const trendPerDay = (r() - 0.5) * 12;
      const m = trainSalesModel(summary(series(hist, { trendPerDay, sd, seed: 300 + k })))!;
      for (const d of series(30, { trendPerDay, sd, seed: 700 + k, from: hist })) {
        n++;
        const a = m.predictInterval(d.date, 0.8);
        const b = m.predictInterval(d.date, 0.95);
        if (d.net_sales >= a.low && d.net_sales <= a.high) in80++;
        if (d.net_sales >= b.low && d.net_sales <= b.high) in95++;
      }
      // Too little history for non-overlapping self-checks → it says so.
      if (hist < 40) expect(m.interval.coverage80).toBeNull();
    }
    expect(in80 / n).toBeGreaterThan(0.78);
    expect(in95 / n).toBeGreaterThan(0.92);
  });

  it("widens week-3/4 ranges when it has no long-horizon evidence", () => {
    const m = trainSalesModel(summary(series(30, { sd: 200, seed: 12 })))!;
    const [w1, w2, w3] = m.interval.bands;
    expect(w2.q80).toBeGreaterThan(w1.q80);
    expect(w3.q80).toBeGreaterThan(w2.q80);
  });

  it("measures its own coverage in backtest, near nominal", () => {
    const m = trainSalesModel(summary(series(120, { sd: 200, seed: 3 })))!;
    expect(m.interval.coverage80).not.toBeNull();
    expect(m.interval.coverage80!).toBeGreaterThan(0.6);
    expect(m.interval.coverage95!).toBeGreaterThanOrEqual(m.interval.coverage80!);
    expect(m.interval.q95).toBeGreaterThanOrEqual(m.interval.q80);
  });

  it("gets less certain when the data is noisier", () => {
    const quiet = trainSalesModel(summary(series(90, { sd: 80, seed: 5 })))!;
    const loud = trainSalesModel(summary(series(90, { sd: 600, seed: 5 })))!;
    expect(loud.interval.q80).toBeGreaterThan(quiet.interval.q80 * 2);
  });
});

describe("sales model — safety rails", () => {
  it("refuses to model fewer than 14 days, or a missing series", () => {
    expect(trainSalesModel(summary(series(13)))).toBeNull();
    expect(trainSalesModel({} as ParsedSalesSummary)).toBeNull();
  });

  it("prefers the simpler model on flat data (parsimony rule)", () => {
    const m = trainSalesModel(summary(series(90, { trendPerDay: 0, sd: 150, seed: 21 })))!;
    expect(m.chosen).not.toBe("ridge-trend-dow");
    expect(Math.abs(m.trendPct)).toBeLessThan(0.01);
  });

  it("never forecasts negative revenue", () => {
    const m = trainSalesModel(summary(series(60, { trendPerDay: -60, sd: 100 })))!;
    for (let t = 60; t < 200; t++) expect(m.predict(iso(t))).toBeGreaterThanOrEqual(0);
  });

  it("gives identical forecasts in every timezone (server UTC vs owner's browser)", () => {
    const data = series(60, { trendPerDay: 3 });
    const original = process.env.TZ;
    const outputs: string[] = [];
    for (const tz of ["UTC", "Asia/Kolkata", "America/Los_Angeles", "Pacific/Auckland"]) {
      process.env.TZ = tz;
      const m = trainSalesModel(summary(data))!;
      outputs.push(JSON.stringify([m.chosen, m.cv.mae, m.predict("2026-03-08"), m.predict("2026-11-01"), m.strongestDow]));
    }
    process.env.TZ = original;
    expect(new Set(outputs).size).toBe(1);
  });
});

describe("building blocks", () => {
  it("conformal quantile is finite-sample valid", () => {
    const r = Array.from({ length: 9 }, (_, i) => i + 1); // 1..9
    // ceil((9+1)*0.8) = 8th smallest
    expect(conformalQuantile(r, 0.2)).toBe(8);
    // too few points for 95% → honest answer is the max
    expect(conformalQuantile(r, 0.05)).toBe(9);
    expect(conformalQuantile([], 0.2)).toBe(0);
  });

  it("walk-forward folds never train on the future", () => {
    const s = series(45);
    for (const f of walkForwardFolds(s)) {
      const lastTrain = f.train[f.train.length - 1].date;
      expect(f.test.every((d) => d.date > lastTrain)).toBe(true);
    }
  });
});
