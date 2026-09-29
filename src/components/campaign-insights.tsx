"use client";

import * as React from "react";
import {
  Brain,
  LineChart,
  Flame,
  Utensils,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarRange,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type { CampaignWithDays, DayOfWeek, Daypart } from "@/lib/types";
import { DAYPARTS, DAYPART_WINDOWS } from "@/lib/types";
import { Card } from "@/components/ui";
import { ForecastChart, Heatmap, HBars, Donut, type ForecastPoint } from "@/components/charts";
import { validateProjection } from "@/lib/validate";
import { trainSalesModel, type SalesModel } from "@/lib/model";
import { ValidationCard } from "@/components/projection-panel";
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatShortDate,
  addDays,
  dowFull,
} from "@/lib/utils";

const DOW_ORDER: DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DOW_SHORT: Record<DayOfWeek, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

/**
 * The Intelligence tab — one narrative, top to bottom:
 *   1. What the model LEARNED from your history (trained + backtested)
 *   2. What will happen next (forecast with an honest error band)
 *   3. Where demand lives (heatmap) and what sells (item mix)
 *   4. Why you can trust it (assumptions + checks)
 */
export function CampaignIntelligence({ campaign }: { campaign: CampaignWithDays }) {
  const brand = campaign.brand?.primary_color || "#f75410";
  const s = campaign.sales_summary;

  const model = React.useMemo(() => trainSalesModel(s), [s]);
  const v = React.useMemo(() => validateProjection(campaign), [campaign]);
  const { series, forecastTotal } = React.useMemo(
    () => buildForecast(campaign, model),
    [campaign, model]
  );

  const { matrix, peakCell } = React.useMemo(() => buildHeatmap(s), [s]);
  const items = (s.top_items || []).slice(0, 7).map((it) => ({ label: it.name, value: it.net_sales }));

  const pay = s.payment_mix || { credit: 0, cash: 0, other: 0 };
  const paySegments = [
    { label: "Credit", value: pay.credit, color: brand },
    { label: "Cash", value: pay.cash, color: "var(--color-mint-500)" },
    { label: "Other", value: pay.other, color: "var(--border-strong)" },
  ];

  return (
    <div className="space-y-5">
      {/* ============ 1 · WHAT THE MODEL LEARNED ============ */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3.5">
          <Brain className="size-4" style={{ color: brand }} />
          <span className="text-sm font-semibold">What the model learned from your sales</span>
          {model ? (
            <span className="ml-auto rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-fg-muted">
              {model.kind} · {model.trainedDays}d · {model.cv.folds}-fold walk-forward · ±{formatCurrency(model.mae)}/day
            </span>
          ) : (
            <span className="ml-auto rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-600">
              regenerate this campaign to train the model on your daily series
            </span>
          )}
        </div>

        {model && (
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {Math.abs(model.trendPct) < 0.005 ? (
              <Learning
                icon={<Minus className="size-4" />}
                tone="neutral"
                kpi="Flat"
                label="Revenue is holding steady week to week — no real trend either way"
              />
            ) : (
              <Learning
                icon={
                  model.trendPerWeek >= 0 ? (
                    <TrendingUp className="size-4" />
                  ) : (
                    <TrendingDown className="size-4" />
                  )
                }
                tone={model.trendPerWeek >= 0 ? "up" : "down"}
                kpi={`${model.trendPerWeek >= 0 ? "+" : "−"}${formatCompactCurrency(Math.abs(model.trendPerWeek))}/wk`}
                label={`Revenue is ${model.trendPerWeek >= 0 ? "growing" : "declining"} ${(Math.abs(model.trendPct) * 100).toFixed(1)}% a week`}
              />
            )}
            <Learning
              icon={<CalendarRange className="size-4" />}
              tone="up"
              kpi={DOW_SHORT[model.strongestDow]}
              label={`Your strongest day — runs ${formatCompactCurrency(model.dowEffect[model.strongestDow])} above an average day`}
            />
            <Learning
              icon={<CalendarRange className="size-4" />}
              tone="down"
              kpi={DOW_SHORT[model.weakestDow]}
              label={`Your weakest day — ${formatCompactCurrency(Math.abs(model.dowEffect[model.weakestDow]))} below average. The plan attacks it`}
            />
            <Learning
              icon={<Sparkles className="size-4" />}
              tone={model.cv.skill > 0 ? "up" : "neutral"}
              kpi={`±${(model.mape * 100).toFixed(1)}%`}
              label={`Typical error on ${model.cv.testDays} days it never saw${
                model.cv.skill > 0
                  ? ` — ${(model.cv.skill * 100).toFixed(0)}% more accurate than "same as last week"`
                  : ""
              }`}
            />
          </div>
        )}

        {model && <ModelCard model={model} brand={brand} />}

        {/* Every weekday's fitted effect, as one glanceable rhythm strip. */}
        {model && (
          <div className="border-t border-border px-5 py-4">
            <div className="mb-3 text-xs font-semibold text-fg-muted">
              Your week&apos;s rhythm — each day vs an average day
            </div>
            <div className="flex items-end gap-2">
              {DOW_ORDER.map((d) => {
                const eff = model.dowEffect[d];
                const maxEff = Math.max(...DOW_ORDER.map((x) => Math.abs(model.dowEffect[x])), 1);
                const h = 8 + (Math.abs(eff) / maxEff) * 40;
                const up = eff >= 0;
                return (
                  <div key={d} className="flex flex-1 flex-col items-center gap-1.5">
                    <span
                      className={`text-[10px] font-medium tabular-nums ${up ? "text-mint-600" : "text-rose-600"}`}
                    >
                      {up ? "+" : "−"}
                      {formatCompactCurrency(Math.abs(eff))}
                    </span>
                    <div
                      className="w-full rounded-md transition-all"
                      style={{
                        height: `${h}px`,
                        background: up ? "var(--color-mint-500)" : "var(--color-rose-accent)",
                        opacity: 0.25 + (Math.abs(eff) / maxEff) * 0.75,
                      }}
                      title={`${d}: ${up ? "+" : "−"}${formatCompactCurrency(Math.abs(eff))} vs average`}
                    />
                    <span className="text-[10px] text-fg-subtle">{DOW_SHORT[d]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {model && model.anomalies.length > 0 && (
          <div className="border-t border-border px-5 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
              <AlertTriangle className="size-3.5 text-amber-500" /> Days that broke the pattern
            </div>
            <div className="flex flex-wrap gap-2">
              {model.anomalies.map((a) => (
                <span
                  key={a.date}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    a.sigma > 0 ? "bg-mint-500/12 text-mint-600" : "bg-rose-500/12 text-rose-600"
                  }`}
                  title={`expected ${formatCurrency(a.expected)}, actual ${formatCurrency(a.actual)}`}
                >
                  {formatShortDate(a.date)}: {a.sigma > 0 ? "beat" : "missed"} the model by{" "}
                  {formatCompactCurrency(Math.abs(a.actual - a.expected))} ({a.sigma > 0 ? "+" : ""}
                  {a.sigma.toFixed(1)}σ)
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ============ 2 · THE FORECAST ============ */}
      <Card className="p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          <LineChart className="size-4" style={{ color: brand }} /> Next 30 days, predicted
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display text-4xl tracking-tight">
              {formatCurrency(forecastTotal)} <span className="text-lg text-fg-subtle">predicted</span>
            </div>
            <div className="mt-1 text-xs text-fg-subtle">
              {model
                ? `model prediction per day + campaign lift · band ${formatCompactCurrency(v.baseline + v.low)}–${formatCompactCurrency(v.baseline + v.high)}`
                : `weekday-average baseline + campaign lift · band ${formatCompactCurrency(v.baseline + v.low)}–${formatCompactCurrency(v.baseline + v.high)}`}
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
            style={{ background: `${brand}18`, color: brand }}
          >
            <TrendingUp className="size-3.5" /> {v.confidence} confidence
          </span>
        </div>
        <div className="mt-4">
          <ForecastChart series={series} color={brand} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-fg-subtle">
          <Legend swatch="var(--color-mint-500)" label={model ? "Your actual daily sales" : "Weekday-pattern history"} />
          <Legend swatch={brand} label="Predicted, day by day" />
          <Legend swatch={brand} faded label="Uncertainty band" />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ============ 3a · WHERE DEMAND LIVES ============ */}
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Flame className="size-4" style={{ color: brand }} /> Where your demand lives
          </div>
          <p className="mb-4 text-xs text-fg-subtle">
            Orders by day and service window — darker is busier. Peak: {peakCell}.
          </p>
          <Heatmap
            rows={DOW_ORDER.map((d) => DOW_SHORT[d])}
            cols={DAYPARTS.map((d) => d.replace("-", "‑"))}
            matrix={matrix}
            color={brand}
          />
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-fg-subtle sm:grid-cols-3">
            {DAYPARTS.map((d) => (
              <span key={d}>
                <span className="font-medium text-fg-muted">{d}</span> {DAYPART_WINDOWS[d]}
              </span>
            ))}
          </div>
        </Card>

        {/* ============ 3b · WHAT SELLS ============ */}
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Utensils className="size-4" style={{ color: brand }} /> What sells
          </div>
          <p className="mb-4 text-xs text-fg-subtle">
            Top items by revenue ({formatNumber(s.top_items?.length ?? 0)} tracked) · avg check{" "}
            {formatCurrency(s.total_net_sales / Math.max(1, s.order_count))}
          </p>
          <HBars data={items} color={brand} format={(nn) => formatCompactCurrency(nn)} />
          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-2 text-xs font-semibold text-fg-muted">Payment mix</div>
            <Donut segments={paySegments} size={104} />
          </div>
        </Card>
      </div>

      {/* ============ 4 · WHY YOU CAN TRUST IT ============ */}
      <ValidationCard campaign={campaign} />
    </div>
  );
}

/**
 * The model card: which forecaster won and why, how it compares to the naive
 * benchmark, and whether its stated uncertainty held up in backtest.
 * Collapsed by default — the owner sees the verdict, an analyst can audit.
 */
function ModelCard({ model, brand }: { model: SalesModel; brand: string }) {
  const best = Math.min(...model.cv.candidates.map((c) => c.mae));
  const worst = Math.max(...model.cv.candidates.map((c) => c.mae), model.cv.naiveMae, 1);
  const LABELS: Record<string, string> = {
    "ridge-trend-dow": "Trend + weekday regression",
    "ridge-dow": "Weekday regression",
    "seasonal-mean": "Seasonal average (last 4 weeks)",
  };
  const cov = model.interval.coverage80;
  return (
    <details className="group border-t border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-xs">
        <span className="font-semibold text-fg-muted">How accurate is this?</span>
        <span className="text-fg-subtle">
          {cov !== null
            ? `Its 80% range held the real number ${(cov * 100).toFixed(0)}% of the time on unseen days.`
            : `Only ${model.trainedDays} days of history — too short to test its own ranges yet, so they're deliberately wide. Export 45+ days to sharpen them.`}
        </span>
        <span className="ml-auto font-mono text-[10px] text-fg-subtle transition group-open:rotate-90">▸</span>
      </summary>
      <div className="grid gap-6 px-5 pb-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            3 models competed · lower error wins
          </div>
          <div className="space-y-1.5">
            {[...model.cv.candidates]
              .sort((a, b) => a.mae - b.mae)
              .map((c) => (
                <Bar
                  key={c.name}
                  label={LABELS[c.name] ?? c.name}
                  value={c.mae}
                  max={worst}
                  color={c.name === model.chosen ? brand : "var(--border-strong)"}
                  tag={c.name === model.chosen ? "chosen" : c.mae === best ? "tied" : undefined}
                />
              ))}
            <Bar label={`"Same as last week" baseline`} value={model.cv.naiveMae} max={worst} color="var(--color-rose-accent)" tag="benchmark" />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle text-pretty">
            Average $ error per day on {model.cv.testDays} days held out across {model.cv.folds} rolling
            forecasts, each up to {model.interval.calibrationHorizonDays} days ahead. When two models are
            within 2%, the simpler one wins.
          </p>
        </div>
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            Uncertainty widens with distance
          </div>
          <div className="space-y-1.5">
            {model.interval.bands.map((b) => (
              <div key={b.from} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-1.5 text-xs">
                <span className="text-fg-muted">
                  Days {b.from}–{b.to} ahead
                </span>
                <span className="font-mono tabular-nums">±{formatCompactCurrency(b.q80)} <span className="text-fg-subtle">(80%)</span></span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle text-pretty">
            Ranges are conformal: built from the model&apos;s real past mistakes, not an assumed bell
            curve.
            {model.interval.coverage95 !== null &&
              ` The 95% range held ${(model.interval.coverage95 * 100).toFixed(0)}% of the time in backtest.`}{" "}
            No forecast is exact — this tells you how much to trust it.{" "}
            <a href="/accuracy" className="underline">
              Swell&apos;s public accuracy record →
            </a>
          </p>
        </div>
      </div>
    </details>
  );
}

function Bar({ label, value, max, color, tag }: { label: string; value: number; max: number; color: string; tag?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-fg-muted">
          {label}
          {tag && <span className="ml-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-fg-subtle">{tag}</span>}
        </span>
        <span className="font-mono tabular-nums">±{formatCompactCurrency(value)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${Math.max(4, (value / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function Learning({
  icon,
  tone,
  kpi,
  label,
}: {
  icon: React.ReactNode;
  tone: "up" | "down" | "neutral";
  kpi: string;
  label: string;
}) {
  const toneCls =
    tone === "up" ? "text-mint-600" : tone === "down" ? "text-rose-600" : "text-fg-muted";
  return (
    <div className="bg-surface p-4">
      <div className={toneCls}>{icon}</div>
      <div className="mt-1.5 font-display text-2xl tabular-nums leading-none">{kpi}</div>
      <div className="mt-1.5 text-xs text-fg-subtle text-pretty">{label}</div>
    </div>
  );
}

function Legend({ swatch, label, faded = false }: { swatch: string; label: string; faded?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-4 rounded-sm" style={{ background: swatch, opacity: faded ? 0.2 : 1 }} />
      {label}
    </span>
  );
}

// ---- derivations ------------------------------------------------

/**
 * History = the owner's REAL daily sales (last ≤30 days). Forecast = the
 * trained model's per-day prediction plus that day's campaign lift, banded by
 * the model's own noise floor (σ) plus the projection's low/high scenarios.
 * Falls back to weekday averages when no daily series exists (old campaigns).
 */
function buildForecast(
  campaign: CampaignWithDays,
  model: SalesModel | null
): { series: ForecastPoint[]; forecastTotal: number } {
  const s = campaign.sales_summary;
  const days = campaign.days;
  const start = days[0]?.date ?? campaign.start_date;

  const v = validateProjection(campaign);
  const lowR = v.expected > 0 ? v.low / v.expected : 0.6;
  const highR = v.expected > 0 ? v.high / v.expected : 1.4;

  const series: ForecastPoint[] = [];

  if (model && s.daily?.length) {
    for (const d of s.daily.slice(-30)) {
      series.push({ date: d.date, value: Math.round(d.net_sales), kind: "history" });
    }
  } else {
    // Legacy campaigns without a daily series: weekday-average reconstruction.
    const occ = Math.max(1, Math.round((s.date_range?.days ?? 30) / 7));
    for (let i = 21; i >= 1; i--) {
      const date = addDays(start, -i);
      const dow = dowFull(date) as DayOfWeek;
      series.push({
        date,
        value: Math.round((s.by_dayofweek?.[dow]?.net_sales ?? 0) / occ),
        kind: "history",
      });
    }
  }

  let forecastTotal = 0;
  for (const d of days) {
    const base = model
      ? model.predict(d.date)
      : (() => {
          const occ = Math.max(1, Math.round((s.date_range?.days ?? 30) / 7));
          const dow = dowFull(d.date) as DayOfWeek;
          return (s.by_dayofweek?.[dow]?.net_sales ?? 0) / occ;
        })();
    const value = Math.round(base + d.projected_revenue);
    forecastTotal += value;
    // Calibrated 80% conformal interval for the baseline (widens with
    // horizon, from real out-of-sample errors), plus the campaign-lift
    // scenario band. Legacy campaigns without a model fall back to ±20%.
    const iv = model ? model.predictInterval(d.date, 0.8) : { low: base * 0.8, high: base * 1.2 };
    series.push({
      date: d.date,
      value,
      kind: "forecast",
      low: Math.max(0, Math.round(iv.low + d.projected_revenue * lowR)),
      high: Math.round(iv.high + d.projected_revenue * highR),
    });
  }

  return { series, forecastTotal };
}

function buildHeatmap(s: CampaignWithDays["sales_summary"]): {
  matrix: number[][];
  peakCell: string;
} {
  const totalOrders = s.order_count || 1;
  const dowShare = (d: DayOfWeek) => (s.by_dayofweek?.[d]?.orders ?? 0) / totalOrders;
  const dpShare = (dp: Daypart) => (s.by_daypart?.[dp]?.orders ?? 0) / totalOrders;

  const raw: number[][] = DOW_ORDER.map((d) => DAYPARTS.map((dp) => dowShare(d) * dpShare(dp)));
  const peak = Math.max(...raw.flat(), 1e-9);

  let best = { v: -1, r: 0, c: 0 };
  raw.forEach((row, r) =>
    row.forEach((val, c) => {
      if (val > best.v) best = { v: val, r, c };
    })
  );
  const matrix = raw.map((row) => row.map((val) => val / peak));
  const peakCell = `${DOW_SHORT[DOW_ORDER[best.r]]} ${DAYPARTS[best.c]}`;
  return { matrix, peakCell };
}
