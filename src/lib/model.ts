import type { ParsedSalesSummary, DailySales, DayOfWeek } from "./types";

// ============================================================
// Swell — Sales Intelligence Model (v2)
//
// No forecaster is 100% accurate: restaurant sales depend on things nobody
// knows in advance. What this model guarantees instead is that it is as
// accurate as the data allows, and HONEST about how accurate that is.
//
//   1. Model selection. Three candidate forecasters compete:
//        ridge · trend + day-of-week
//        ridge · day-of-week        (no trend — resists over-extrapolating)
//        seasonal mean              (avg of the last 4 same weekdays)
//      The winner is chosen by out-of-sample error, never in-sample fit.
//
//   2. Walk-forward cross-validation. Train on days 1..k, forecast the next
//      7, slide forward, repeat. Every accuracy number is measured on days the
//      model had not seen — a single holdout is one noisy sample.
//
//   3. Beat-the-baseline. Every run is scored against seasonal-naive
//      ("same as last week's same weekday"), the standard forecasting
//      benchmark. MASE < 1 means the model genuinely adds skill.
//
//   4. Conformal prediction intervals. Interval widths come from the
//      distribution of real out-of-sample errors (split conformal), and
//      their empirical coverage is measured by cross-conformal backtest:
//      "our 80% range contained the actual value X% of the time."
//
// Pure TypeScript, zero dependencies, deterministic, UTC-only date math —
// identical output on the server and in the owner's browser.
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

export type ModelName = "ridge-trend-dow" | "ridge-dow" | "seasonal-mean";

export const MODEL_LABEL: Record<ModelName, string> = {
  "ridge-trend-dow": "ridge · trend + day-of-week",
  "ridge-dow": "ridge · day-of-week",
  "seasonal-mean": "seasonal mean · last 4 same weekdays",
};

export type CrossValidation = {
  folds: number;
  /** Out-of-sample days scored across all folds. */
  testDays: number;
  /** Out-of-sample mean absolute error of the chosen model ($/day). */
  mae: number;
  /** Out-of-sample mean absolute percentage error (0..1). */
  mape: number;
  /** Same folds, seasonal-naive baseline ($/day). */
  naiveMae: number;
  /** 1 − mae/naiveMae. Positive = the model beats the naive benchmark. */
  skill: number;
  /** Mean absolute scaled error vs in-sample seasonal naive. < 1 is good. */
  mase: number;
  /** Every candidate's out-of-sample MAE — the selection is auditable. */
  candidates: { name: ModelName; mae: number }[];
};

/** Interval half-widths for one horizon band, from errors at that horizon. */
export type HorizonBand = { from: number; to: number; q80: number; q95: number; n: number };

export type Interval = {
  /** Half-width of the 80% / 95% interval for the next week ($/day). */
  q80: number;
  q95: number;
  /** Half-widths per forecast-horizon band — they widen as errors grow. */
  bands: HorizonBand[];
  /** Cross-conformal empirical coverage (0..1), null with a single fold. */
  coverage80: number | null;
  coverage95: number | null;
  /** Intervals are calibrated on 1..N-day-ahead errors (the campaign length). */
  calibrationHorizonDays: number;
};

export type SalesModel = {
  /** Human label of the chosen forecaster. */
  kind: string;
  chosen: ModelName;
  trainedDays: number;
  /** Out-of-sample days scored (walk-forward). */
  holdoutDays: number;
  /** Out-of-sample MAE ($/day) — same as cv.mae, kept for existing callers. */
  mae: number;
  /** Out-of-sample MAPE (0..1). */
  mape: number;
  cv: CrossValidation;
  interval: Interval;
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
  /** Point forecast for a future ISO date (chosen model, refit on all data). */
  predict: (isoDate: string) => number;
  /** Calibrated prediction interval for a future ISO date. */
  predictInterval: (isoDate: string, level?: 0.8 | 0.95) => { low: number; high: number };
  /** In-sample residual std-dev of the interpretable fit (anomaly detection). */
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

// ---- UTC date helpers (identical on server and browser) -----

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}
function dayIndex(iso: string): number {
  const [y, m, d] = parts(iso);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}
function dowOf(iso: string): number {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
}

/** [1, (trend), Mon..Sat one-hots] — Sunday is the baseline. */
function features(iso: string, t0: number, withTrend: boolean): number[] {
  const dow = dowOf(iso);
  const oneHots = Array(6).fill(0);
  if (dow > 0) oneHots[dow - 1] = 1;
  return withTrend ? [1, dayIndex(iso) - t0, ...oneHots] : [1, ...oneHots];
}

// ---- candidate forecasters ----------------------------------

type Predictor = (iso: string) => number;
type Fitter = (rows: DailySales[], t0: number) => Predictor;

const RIDGE_LAMBDA = 1.0;

function ridgeFitter(withTrend: boolean): Fitter {
  return (rows, t0) => {
    const beta = ridgeFit(
      rows.map((d) => features(d.date, t0, withTrend)),
      rows.map((d) => d.net_sales),
      RIDGE_LAMBDA
    );
    return (iso) => {
      const f = features(iso, t0, withTrend);
      let v = 0;
      for (let i = 0; i < f.length; i++) v += f[i] * beta[i];
      return Math.max(0, v);
    };
  };
}

/** Mean of the last `k` observations of the same weekday. */
function seasonalMeanFitter(k: number): Fitter {
  return (rows) => {
    const byDow: number[][] = Array.from({ length: 7 }, () => []);
    for (const d of rows) byDow[dowOf(d.date)].push(d.net_sales);
    const overall = rows.reduce((a, d) => a + d.net_sales, 0) / Math.max(1, rows.length);
    const means = byDow.map((vals) => {
      const tail = vals.slice(-k);
      return tail.length ? tail.reduce((a, v) => a + v, 0) / tail.length : overall;
    });
    return (iso) => means[dowOf(iso)];
  };
}

/** Seasonal naive: "same as the last observed same weekday". The benchmark. */
const seasonalNaiveFitter: Fitter = seasonalMeanFitter(1);

const CANDIDATES: Record<ModelName, Fitter> = {
  "ridge-trend-dow": ridgeFitter(true),
  "ridge-dow": ridgeFitter(false),
  "seasonal-mean": seasonalMeanFitter(4),
};

// ---- conformal ------------------------------------------------

/**
 * Split-conformal quantile of absolute residuals for miscoverage `alpha`.
 * With m calibration residuals the finite-sample-valid index is
 * ceil((m+1)(1−alpha)); if that exceeds m the honest answer is the max.
 */
export function conformalQuantile(absResiduals: number[], alpha: number): number {
  const m = absResiduals.length;
  if (m === 0) return 0;
  const sorted = [...absResiduals].sort((a, b) => a - b);
  const idx = Math.ceil((m + 1) * (1 - alpha)) - 1;
  return sorted[Math.min(Math.max(idx, 0), m - 1)];
}

// ---- walk-forward CV -----------------------------------------

/** The campaign length — the horizon every accuracy claim must hold over. */
export const CALIBRATION_HORIZON = 30;
const ORIGIN_STEP = 7;
/** Horizon bands with their own calibrated interval widths. */
const BANDS: [number, number][] = [
  [1, 7],
  [8, 14],
  [15, CALIBRATION_HORIZON],
];
/** A band needs this many out-of-sample errors to be trusted on its own. */
const MIN_BAND_N = 8;

type Fold = { train: DailySales[]; test: DailySales[] };
type Residual = { r: number; y: number; h: number };

/**
 * Rolling-origin folds: expanding training window, a new origin every week,
 * each forecasting up to the full campaign horizon ahead. Selection and
 * calibration therefore reflect 1..30-day-ahead error — how the product is
 * actually used — not just next-week error.
 */
export function walkForwardFolds(series: DailySales[], horizon = CALIBRATION_HORIZON): Fold[] {
  const n = series.length;
  const minTrain = Math.max(7, Math.min(Math.max(21, Math.ceil(n * 0.4)), n - ORIGIN_STEP));
  // Short histories get an origin every day: a month of data yields ~45
  // out-of-sample errors instead of ~11, which is what calibration needs.
  const step = n < 60 ? 1 : n < 120 ? 3 : ORIGIN_STEP;
  const folds: Fold[] = [];
  for (let s = minTrain; s < n; s += step) {
    folds.push({ train: series.slice(0, s), test: series.slice(s, Math.min(s + horizon, n)) });
  }
  return folds;
}

/** Out-of-sample residuals (actual − predicted) per fold, tagged by horizon. */
function cvResiduals(folds: Fold[], fitter: Fitter, t0: number): Residual[][] {
  return folds.map(({ train, test }) => {
    const predict = fitter(train, t0);
    return test.map((d, i) => ({ r: d.net_sales - predict(d.date), y: d.net_sales, h: i + 1 }));
  });
}

/**
 * Conformal half-widths per horizon band. Widths never shrink with horizon.
 * A band without enough out-of-sample errors of its own has no evidence for
 * its horizon, so it is WIDENED from the band before it by √(horizon ratio) —
 * never simply copied, which would claim week-4 is as predictable as week-1.
 */
function calibrateBands(residuals: Residual[]): HorizonBand[] {
  const out: HorizonBand[] = [];
  const all = residuals.map((x) => Math.abs(x.r));
  for (const [from, to] of BANDS) {
    const abs = residuals.filter((x) => x.h >= from && x.h <= to).map((x) => Math.abs(x.r));
    const prev = out[out.length - 1];
    let q80: number;
    let q95: number;
    if (abs.length >= MIN_BAND_N) {
      q80 = conformalQuantile(abs, 0.2);
      q95 = conformalQuantile(abs, 0.05);
    } else if (prev) {
      const grow = Math.sqrt((from + to) / (prev.from + prev.to));
      q80 = prev.q80 * grow;
      q95 = prev.q95 * grow;
    } else {
      q80 = conformalQuantile(all, 0.2);
      q95 = conformalQuantile(all, 0.05);
    }
    if (prev) {
      q80 = Math.max(q80, prev.q80);
      q95 = Math.max(q95, prev.q95);
    }
    out.push({ from, to, q80, q95, n: abs.length });
  }
  return out;
}

function bandFor(bands: HorizonBand[], h: number): HorizonBand {
  return bands.find((b) => h <= b.to) ?? bands[bands.length - 1];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ---- the model ----------------------------------------------

/**
 * Train, cross-validate, select, and calibrate on the uploaded daily series.
 * Returns null when the series is missing (campaigns parsed before `daily`
 * existed) or too short to say anything honest (< 14 days).
 */
export function trainSalesModel(sales: ParsedSalesSummary): SalesModel | null {
  const daily = sales.daily;
  if (!daily || daily.length < 14) return null;

  const series = [...daily].sort((a, b) => (a.date < b.date ? -1 : 1));
  const t0 = dayIndex(series[0].date);
  const folds = walkForwardFolds(series);

  // 1 — score every candidate out of sample, pick the best.
  const scored = (Object.keys(CANDIDATES) as ModelName[]).map((name) => {
    const perFold = cvResiduals(folds, CANDIDATES[name], t0);
    const flat = perFold.flat();
    return { name, perFold, mae: mean(flat.map((x) => Math.abs(x.r))), flat };
  });
  // Parsimony rule: among candidates within 2% of the best out-of-sample
  // error, pick the SIMPLEST. With few folds, a slightly-better complex model
  // is more likely noise than skill.
  const COMPLEXITY: Record<ModelName, number> = { "seasonal-mean": 0, "ridge-dow": 1, "ridge-trend-dow": 2 };
  const minMae = Math.min(...scored.map((c) => c.mae));
  const best = scored
    .filter((c) => c.mae <= minMae * 1.02 + 1e-9)
    .sort((a, b) => COMPLEXITY[a.name] - COMPLEXITY[b.name])[0];

  const flat = best.flat;
  const cvMae = best.mae;
  const cvMape = mean(flat.map((x) => Math.abs(x.r) / Math.max(x.y, 1)));

  // 2 — the benchmark, on the very same folds.
  const naiveFlat = cvResiduals(folds, seasonalNaiveFitter, t0).flat();
  const naiveMae = mean(naiveFlat.map((x) => Math.abs(x.r)));
  const skill = naiveMae > 0 ? 1 - cvMae / naiveMae : 0;

  // MASE: scale by in-sample seasonal-naive error (lag 7) — the standard form.
  const lag7: number[] = [];
  for (let i = 7; i < series.length; i++) lag7.push(Math.abs(series[i].net_sales - series[i - 7].net_sales));
  const scale = mean(lag7);
  const mase = scale > 0 ? cvMae / scale : 0;

  // 3 — conformal intervals from REAL out-of-sample errors, per horizon band.
  const bands = calibrateBands(flat);

  // Cross-conformal coverage: calibrate on the other folds, test on this one.
  let coverage80: number | null = null;
  let coverage95: number | null = null;
  // Folds whose test windows overlap share days, so calibrating on one and
  // testing on the other would grade the model on answers it has seen. Only
  // non-overlapping folds calibrate each other; if the history is too short
  // for that, coverage stays null and the UI says so instead of guessing.
  if (best.perFold.length >= 2) {
    let hit80 = 0;
    let hit95 = 0;
    let total = 0;
    const span = folds.map((f) => [f.test[0]?.date ?? "", f.test[f.test.length - 1]?.date ?? ""]);
    best.perFold.forEach((fold, i) => {
      const others = best.perFold.filter((_, j) => j !== i && (span[j][1] < span[i][0] || span[j][0] > span[i][1]));
      const residualsElsewhere = others.flat();
      if (residualsElsewhere.length < MIN_BAND_N) return;
      const calib = calibrateBands(residualsElsewhere);
      for (const x of fold) {
        const b = bandFor(calib, x.h);
        total++;
        if (Math.abs(x.r) <= b.q80) hit80++;
        if (Math.abs(x.r) <= b.q95) hit95++;
      }
    });
    coverage80 = total ? hit80 / total : null;
    coverage95 = total ? hit95 / total : null;
  }

  // 4 — final forecaster: the winner, refit on everything.
  const predict = CANDIDATES[best.name](series, t0);
  const lastIdx = dayIndex(series[series.length - 1].date);
  const predictInterval = (iso: string, level: 0.8 | 0.95 = 0.8) => {
    const c = predict(iso);
    const h = Math.max(1, dayIndex(iso) - lastIdx);
    const b = bandFor(bands, h);
    let half = level === 0.95 ? b.q95 : b.q80;
    // Past the validated horizon there is no out-of-sample evidence at all.
    // Widen with √(h/H) rather than pretend the calibrated width still holds.
    if (h > CALIBRATION_HORIZON) half *= Math.sqrt(h / CALIBRATION_HORIZON);
    return { low: Math.max(0, c - half), high: c + half };
  };

  // 5 — insights always come from the interpretable ridge (trend + weekday),
  //     whichever model forecasts best.
  const beta = ridgeFit(
    series.map((d) => features(d.date, t0, true)),
    series.map((d) => d.net_sales),
    RIDGE_LAMBDA
  );
  const fitted = ridgeFitter(true)(series, t0);
  const residuals = series.map((d) => d.net_sales - fitted(d.date));
  const sigma =
    Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / Math.max(1, residuals.length - 1)) || 1;
  const avgDaily = mean(series.map((d) => d.net_sales));

  // An anomaly must be statistically unusual (>2σ) AND material (a real
  // dollar swing) — otherwise a very well-fit series flags $50 wiggles.
  const materialFloor = Math.max(0.15 * avgDaily, 100);
  const anomalies: Anomaly[] = series
    .map((d, i) => ({
      date: d.date,
      actual: Math.round(d.net_sales),
      expected: Math.round(fitted(d.date)),
      sigma: residuals[i] / sigma,
    }))
    .filter((a) => Math.abs(a.sigma) >= 2 && Math.abs(a.actual - a.expected) >= materialFloor)
    .sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma))
    .slice(0, 4);

  // Weekday effects vs the overall average. Baseline (Sunday) coef is 0.
  const rawEffects = [0, ...beta.slice(2, 8)]; // Sun..Sat aligned to getUTCDay()
  const meanEffect = mean(rawEffects);
  const dowEffect = {} as Record<DayOfWeek, number>;
  DOW_NAMES.forEach((d, i) => {
    dowEffect[d] = Math.round(rawEffects[i] - meanEffect);
  });
  const ranked = [...DOW_NAMES].sort((a, b) => dowEffect[b] - dowEffect[a]);

  const trendPerWeek = beta[1] * 7;
  const trendPct = avgDaily > 0 ? trendPerWeek / (avgDaily * 7) : 0;

  return {
    kind: MODEL_LABEL[best.name],
    chosen: best.name,
    trainedDays: series.length,
    holdoutDays: flat.length,
    mae: Math.round(cvMae),
    mape: cvMape,
    cv: {
      folds: folds.length,
      testDays: flat.length,
      mae: Math.round(cvMae),
      mape: cvMape,
      naiveMae: Math.round(naiveMae),
      skill,
      mase,
      candidates: scored.map((c) => ({ name: c.name, mae: Math.round(c.mae) })),
    },
    interval: {
      q80: Math.round(bands[0].q80),
      q95: Math.round(bands[0].q95),
      bands: bands.map((b) => ({ ...b, q80: Math.round(b.q80), q95: Math.round(b.q95) })),
      coverage80,
      coverage95,
      calibrationHorizonDays: CALIBRATION_HORIZON,
    },
    avgDaily: Math.round(avgDaily),
    trendPerWeek: Math.round(trendPerWeek),
    trendPct,
    dowEffect,
    strongestDow: ranked[0],
    weakestDow: ranked[ranked.length - 1],
    anomalies,
    predict,
    predictInterval,
    sigma,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** One-line human summary, used by the Analyst Agent + strategy notes. */
export function modelSummary(m: SalesModel): string {
  const beats =
    m.cv.skill > 0
      ? `${pct(m.cv.skill)} more accurate than the "same as last week" baseline`
      : `no better than the "same as last week" baseline — so it's used cautiously`;
  const cov =
    m.interval.coverage80 !== null
      ? ` Its 80% range held the true value ${pct(m.interval.coverage80)} of the time in backtest.`
      : "";
  const trend =
    Math.abs(m.trendPct) < 0.005
      ? "Revenue is flat week to week"
      : `Revenue is ${m.trendPerWeek >= 0 ? "growing" : "declining"} $${Math.abs(m.trendPerWeek)}/week (${pct(Math.abs(m.trendPct))})`;
  return (
    `Picked ${m.kind} from 3 competing models by walk-forward cross-validation on ${m.trainedDays} days ` +
    `(${m.cv.folds} folds, ${m.cv.testDays} unseen days): ±$${m.cv.mae}/day typical error (${pct(m.cv.mape)}), ${beats}.` +
    `${cov} ${trend}. Strongest day ${m.strongestDow}, weakest ${m.weakestDow}.`
  );
}
