import type { ParsedSalesSummary, DailySales, DayOfWeek } from "./types";

// ============================================================
// Swell — Sales Intelligence Model
//
// A real (small) learned model, not vibes:
//   • Ridge regression on [trend, day-of-week] fit by normal equations
//   • Backtested on a holdout of the owner's own history → honest MAE
//   • Refit on the full series for forward prediction
//   • Insight extraction: trend, weekday effects, anomaly days
//
// Pure TypeScript, zero dependencies, deterministic — the same numbers
// everywhere it runs (generator, Intelligence tab, assistant).
// ============================================================

const DOW_NAMES: DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type Anomaly = {
  date: string;
  actual: number;
  expected: number;
  /** Residual in standard deviations — sign says over/under-performed. */
  sigma: number;
};

export type SalesModel = {
  kind: "ridge · trend + day-of-week";
  trainedDays: number;
  holdoutDays: number;
  /** Mean absolute error on the holdout window (dollars/day). */
  mae: number;
  /** Mean absolute percentage error on the holdout window (0..1). */
  mape: number;
  /** Average daily revenue over the history. */
  avgDaily: number;
  /** Fitted $/week trend (positive = growing). */
  trendPerWeek: number;
  /** trendPerWeek as a share of avg weekly revenue. */
  trendPct: number;
  /** Each weekday's fitted lift vs the overall average (dollars). */
  dowEffect: Record<DayOfWeek, number>;
  strongestDow: DayOfWeek;
  weakestDow: DayOfWeek;
  /** Days that beat / missed the model's expectation by > 2σ. */
  anomalies: Anomaly[];
  /** Predict net sales for a future ISO date. */
  predict: (isoDate: string) => number;
  /** Residual std-dev — the model's own noise floor. */
  sigma: number;
};

// ---- tiny linear algebra ------------------------------------

/** Solve A·x = b (n×n) via Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const p = M[col][col] || 1e-9;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / p;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-9));
}

/** Ridge fit: β = (XᵀX + λI)⁻¹ Xᵀy (no penalty on the intercept). */
function ridgeFit(X: number[][], y: number[], lambda: number): number[] {
  const k = X[0].length;
  const XtX: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  const Xty: number[] = Array(k).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  for (let a = 1; a < k; a++) XtX[a][a] += lambda; // skip intercept
  return solve(XtX, Xty);
}

// ---- feature engineering ------------------------------------

function dayIndex(iso: string): number {
  return Math.floor(new Date(iso + "T00:00:00").getTime() / 86400000);
}

/** [1, trend, Mon..Sat one-hots] — Sunday is the baseline. */
function features(iso: string, t0: number): number[] {
  const t = dayIndex(iso) - t0;
  const dow = new Date(iso + "T00:00:00").getDay(); // 0=Sun
  const oneHots = Array(6).fill(0);
  if (dow > 0) oneHots[dow - 1] = 1;
  return [1, t, ...oneHots];
}

// ---- the model ----------------------------------------------

/**
 * Train + backtest on the uploaded daily series. Returns null when the
 * series is missing (campaigns parsed before `daily` existed) or too short
 * to say anything honest.
 */
export function trainSalesModel(sales: ParsedSalesSummary): SalesModel | null {
  const daily = sales.daily;
  if (!daily || daily.length < 14) return null;

  const series = [...daily].sort((a, b) => (a.date < b.date ? -1 : 1));
  const t0 = dayIndex(series[0].date);
  const lambda = 1.0;

  const fit = (rows: DailySales[]) => {
    const X = rows.map((d) => features(d.date, t0));
    const y = rows.map((d) => d.net_sales);
    return ridgeFit(X, y, lambda);
  };
  const predictWith = (beta: number[], iso: string) => {
    const f = features(iso, t0);
    let v = 0;
    for (let i = 0; i < f.length; i++) v += f[i] * beta[i];
    return Math.max(0, v);
  };

  // Backtest: hold out the last 7 days, train on the rest.
  const holdoutDays = series.length >= 21 ? 7 : Math.max(3, Math.floor(series.length / 5));
  const trainRows = series.slice(0, series.length - holdoutDays);
  const testRows = series.slice(series.length - holdoutDays);
  const betaTrain = fit(trainRows);
  let absErr = 0;
  let pctErr = 0;
  for (const d of testRows) {
    const pred = predictWith(betaTrain, d.date);
    absErr += Math.abs(pred - d.net_sales);
    pctErr += Math.abs(pred - d.net_sales) / Math.max(d.net_sales, 1);
  }
  const mae = absErr / testRows.length;
  const mape = pctErr / testRows.length;

  // Final model: refit on everything for forward prediction.
  const beta = fit(series);
  const predict = (iso: string) => predictWith(beta, iso);

  // Residuals on the full fit → noise floor + anomaly detection.
  const residuals = series.map((d) => d.net_sales - predict(d.date));
  const sigma =
    Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / Math.max(1, residuals.length - 1)) || 1;
  const avgDaily = series.reduce((a, d) => a + d.net_sales, 0) / series.length;

  // An anomaly must be statistically unusual (>2σ) AND material (a real
  // dollar swing) — otherwise a very well-fit series flags $50 wiggles.
  const materialFloor = Math.max(0.15 * avgDaily, 100);
  const anomalies: Anomaly[] = series
    .map((d, i) => ({
      date: d.date,
      actual: Math.round(d.net_sales),
      expected: Math.round(predict(d.date)),
      sigma: residuals[i] / sigma,
    }))
    .filter((a) => Math.abs(a.sigma) >= 2 && Math.abs(a.actual - a.expected) >= materialFloor)
    .sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma))
    .slice(0, 4);

  // Weekday effects vs the overall average. Baseline (Sunday) coef is 0.
  const rawEffects = [0, ...beta.slice(2, 8)]; // Sun..Sat aligned to getDay()
  const meanEffect = rawEffects.reduce((a, b) => a + b, 0) / 7;
  const dowEffect = {} as Record<DayOfWeek, number>;
  DOW_NAMES.forEach((d, i) => {
    dowEffect[d] = Math.round(rawEffects[i] - meanEffect);
  });
  const ranked = [...DOW_NAMES].sort((a, b) => dowEffect[b] - dowEffect[a]);

  const trendPerWeek = beta[1] * 7;
  const trendPct = avgDaily > 0 ? trendPerWeek / (avgDaily * 7) : 0;

  return {
    kind: "ridge · trend + day-of-week",
    trainedDays: series.length,
    holdoutDays,
    mae: Math.round(mae),
    mape,
    avgDaily: Math.round(avgDaily),
    trendPerWeek: Math.round(trendPerWeek),
    trendPct,
    dowEffect,
    strongestDow: ranked[0],
    weakestDow: ranked[ranked.length - 1],
    anomalies,
    predict,
    sigma,
  };
}

/** One-line human summary, used by the Analyst Agent + strategy notes. */
export function modelSummary(m: SalesModel): string {
  const dir = m.trendPerWeek >= 0 ? "growing" : "declining";
  return (
    `Trained ${m.kind} on ${m.trainedDays} days, backtested on the last ${m.holdoutDays} ` +
    `(MAE ±$${m.mae}/day, ${(m.mape * 100).toFixed(1)}% error). Revenue is ${dir} ` +
    `$${Math.abs(m.trendPerWeek).toFixed(0)}/week (${(m.trendPct * 100).toFixed(1)}%). ` +
    `Strongest day ${m.strongestDow}, weakest ${m.weakestDow}.`
  );
}
