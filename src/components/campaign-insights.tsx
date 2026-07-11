"use client";

import * as React from "react";
import { LineChart, Flame, Utensils, Clock, TrendingUp, CalendarRange } from "lucide-react";
import type { CampaignWithDays, DayOfWeek, Daypart } from "@/lib/types";
import { DAYPARTS, DAYPART_WINDOWS } from "@/lib/types";
import { Card } from "@/components/ui";
import { ForecastChart, Heatmap, HBars, type ForecastPoint } from "@/components/charts";
import { validateProjection } from "@/lib/validate";
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  parseLocalDate,
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
 * A dedicated analytics view: a revenue forecast (real history → projected next
 * 30 days, with a confidence band), a busy-window heatmap, and the item mix —
 * all derived from the same numbers the plan and the projection use.
 */
export function CampaignInsights({ campaign }: { campaign: CampaignWithDays }) {
  const brand = campaign.brand?.primary_color || "#f75410";
  const s = campaign.sales_summary;
  const v = React.useMemo(() => validateProjection(campaign), [campaign]);

  const { series, forecastTotal } = React.useMemo(
    () => buildForecast(campaign),
    [campaign]
  );

  // Busy-window heatmap: dow × daypart, intensity = order-share product.
  const { matrix, peakCell } = React.useMemo(() => buildHeatmap(s), [s]);

  const items = (s.top_items || []).slice(0, 7).map((it) => ({
    label: it.name,
    value: it.net_sales,
  }));

  const bestDow = [...DOW_ORDER]
    .filter((d) => s.by_dayofweek?.[d])
    .sort((a, b) => (s.by_dayofweek[b]?.net_sales ?? 0) - (s.by_dayofweek[a]?.net_sales ?? 0))[0];

  return (
    <div className="space-y-5">
      {/* ---- forecast hero ---- */}
      <Card className="p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          <LineChart className="size-4" style={{ color: brand }} /> 30-day revenue forecast
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display text-4xl tracking-tight">
              {formatCurrency(forecastTotal)}{" "}
              <span className="text-lg text-fg-subtle">projected</span>
            </div>
            <div className="mt-1 text-xs text-fg-subtle">
              trained on {s.date_range?.days ?? 0} days of your sales · band{" "}
              {formatCompactCurrency(v.baseline + v.low)}–{formatCompactCurrency(v.baseline + v.high)}
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
          <Legend swatch="var(--color-mint-500)" label="Your history (daily pattern)" />
          <Legend swatch={brand} label="Projected next 30 days" />
          <Legend swatch={brand} faded label="Confidence band (low → high)" />
        </div>
      </Card>

      {/* ---- KPIs ---- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<CalendarRange className="size-4" />} label="Busiest day" value={bestDow ? DOW_SHORT[bestDow] : "—"} brand={brand} />
        <Kpi icon={<Clock className="size-4" />} label="Peak window" value={peakCell} brand={brand} />
        <Kpi icon={<Utensils className="size-4" />} label="Menu items sold" value={formatNumber(s.top_items?.length ?? 0)} brand={brand} />
        <Kpi icon={<TrendingUp className="size-4" />} label="Avg check" value={formatCurrency(s.total_net_sales / Math.max(1, s.order_count))} brand={brand} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- busy-hour heatmap ---- */}
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Flame className="size-4" style={{ color: brand }} /> Busy-window heatmap
          </div>
          <p className="mb-4 text-xs text-fg-subtle">
            Where your demand concentrates, by day and service. Darker = busier.
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

        {/* ---- item mix ---- */}
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Utensils className="size-4" style={{ color: brand }} /> Where the money comes from
          </div>
          <p className="mb-4 text-xs text-fg-subtle">Top items by revenue in your upload.</p>
          <HBars data={items} color={brand} format={(nn) => formatCompactCurrency(nn)} />
        </Card>
      </div>
    </div>
  );
}

function Legend({ swatch, label, faded = false }: { swatch: string; label: string; faded?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-4 rounded-sm"
        style={{ background: swatch, opacity: faded ? 0.2 : 1 }}
      />
      {label}
    </span>
  );
}

function Kpi({
  icon,
  label,
  value,
  brand,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  brand: string;
}) {
  return (
    <Card className="p-4">
      <div style={{ color: brand }}>{icon}</div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-xs text-fg-subtle">{label}</div>
    </Card>
  );
}

// ---- derivations ------------------------------------------------

/**
 * Reconstruct a believable daily history from the real day-of-week averages,
 * then extend it into the projected next 30 days (baseline for that weekday +
 * the day's incremental), with a low/high band from the projection scenarios.
 */
function buildForecast(campaign: CampaignWithDays): { series: ForecastPoint[]; forecastTotal: number } {
  const s = campaign.sales_summary;
  const days = campaign.days;
  const occ = Math.max(1, Math.round((s.date_range?.days ?? 30) / 7));
  const dowAvg = (iso: string) => {
    const d = dowFull(iso) as DayOfWeek;
    return (s.by_dayofweek?.[d]?.net_sales ?? 0) / occ;
  };

  const v = validateProjection(campaign);
  const lowR = v.expected > 0 ? v.low / v.expected : 0.6;
  const highR = v.expected > 0 ? v.high / v.expected : 1.4;

  const series: ForecastPoint[] = [];

  // history: the 21 days leading up to the campaign start
  const start = days[0]?.date ?? campaign.start_date;
  for (let i = 21; i >= 1; i--) {
    const date = addDays(start, -i);
    series.push({ date, value: Math.round(dowAvg(date)), kind: "history" });
  }

  // forecast: each campaign day = weekday baseline + incremental (+ band)
  let forecastTotal = 0;
  for (const d of days) {
    const base = dowAvg(d.date);
    const value = Math.round(base + d.projected_revenue);
    forecastTotal += value;
    series.push({
      date: d.date,
      value,
      kind: "forecast",
      low: Math.round(base + d.projected_revenue * lowR),
      high: Math.round(base + d.projected_revenue * highR),
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
