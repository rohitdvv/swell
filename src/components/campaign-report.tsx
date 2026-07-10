"use client";

import * as React from "react";
import { TrendingUp, ArrowUpRight, Ticket, Utensils } from "lucide-react";
import type { CampaignWithDays } from "@/lib/types";
import { DAYPARTS } from "@/lib/types";
import { Card } from "@/components/ui";
import { BarChart, HBars, AreaSpark, Donut } from "@/components/charts";
import { formatCompactCurrency, formatCurrency, formatNumber } from "@/lib/utils";

const DOW_SHORT: Record<string, string> = {
  Sunday: "Sun",
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
};
const DOW_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function CampaignReport({ campaign }: { campaign: CampaignWithDays }) {
  const brand = campaign.brand?.primary_color || "#f75410";
  const s = campaign.sales_summary;
  const days = campaign.days;

  const baseline = campaign.baseline_revenue;
  const projectedTotal = baseline + campaign.projected_revenue;
  const upliftPct = baseline > 0 ? (campaign.projected_revenue / baseline) * 100 : 0;

  const dowData = DOW_ORDER.filter((d) => s.by_dayofweek?.[d as keyof typeof s.by_dayofweek]).map((d) => ({
    label: DOW_SHORT[d],
    value: s.by_dayofweek[d as keyof typeof s.by_dayofweek].net_sales,
  }));

  // promo focus per daypart (how many of the 30 days target each)
  const focus: Record<string, number> = {};
  for (const d of days) focus[d.daypart] = (focus[d.daypart] || 0) + 1;
  const daypartData = DAYPARTS.filter((dp) => s.by_daypart?.[dp]?.orders > 0).map((dp) => ({
    label: dp,
    value: s.by_daypart[dp].net_sales,
    hot: (focus[dp] || 0) >= 6, // heavily targeted windows
  }));

  const itemData = (s.top_items || []).slice(0, 6).map((it) => ({
    label: it.name,
    value: it.net_sales,
  }));

  const pay = s.payment_mix || { credit: 0, cash: 0, other: 0 };
  const paySegments = [
    { label: "Credit", value: pay.credit, color: brand },
    { label: "Cash", value: pay.cash, color: "var(--color-mint-500)" },
    { label: "Other", value: pay.other, color: "var(--border-strong)" },
  ];

  const revPoints = days.map((d) => d.projected_revenue);
  const markers = days
    .map((d, i) => (d.event ? { index: i, icon: d.event.type === "holiday" ? "🎉" : "🎫" } : null))
    .filter(Boolean) as { index: number; icon: string }[];
  const totalRed = days.reduce((a, d) => a + d.projected_redemptions, 0);
  const totalCovers = days.reduce((a, d) => a + (d.expected_covers || 0), 0);

  return (
    <div className="space-y-5">
      {/* headline: last month vs projected */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="size-4" style={{ color: brand }} />
          <span className="text-sm font-semibold">Last 30 days → projected next 30</span>
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
            style={{ background: brand }}
          >
            <ArrowUpRight className="size-3" /> +{upliftPct.toFixed(1)}%
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <BeforeAfter baseline={baseline} projected={projectedTotal} incremental={campaign.projected_revenue} brand={brand} />
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={<TrendingUp className="size-4" />} label="Projected incremental" value={formatCompactCurrency(campaign.projected_revenue)} brand={brand} />
            <MiniStat icon={<Ticket className="size-4" />} label="Projected redemptions" value={formatNumber(totalRed)} brand={brand} />
            <MiniStat icon={<Utensils className="size-4" />} label="Covers to prep (30d)" value={formatNumber(totalCovers)} brand={brand} />
            <MiniStat icon={<ArrowUpRight className="size-4" />} label="Avg check" value={formatCurrency(s.total_net_sales / Math.max(1, s.order_count))} brand={brand} />
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <ChartHead title="Net sales by day of week" sub="From your upload" />
          <BarChart data={dowData} color={brand} format={(n) => formatCompactCurrency(n)} />
        </Card>

        <Card className="p-5">
          <ChartHead title="Projected daily revenue" sub="Next 30 days · markers = local events" />
          <AreaSpark points={revPoints} color={brand} markers={markers} />
          <p className="mt-2 text-xs text-fg-subtle">
            {markers.length
              ? `${markers.length} local event day${markers.length === 1 ? "" : "s"} in this window`
              : "No holidays/events in this window — add a Ticketmaster key for live concerts & sports."}
          </p>
        </Card>

        <Card className="p-5">
          <ChartHead title="Daypart mix" sub="Highlighted = windows Swell is targeting" />
          <HBars data={daypartData} color={brand} format={(n) => formatCompactCurrency(n)} />
        </Card>

        <Card className="p-5">
          <ChartHead title="Top items by revenue" sub="Your best sellers" />
          <HBars data={itemData} color={brand} format={(n) => formatCompactCurrency(n)} />
        </Card>

        <Card className="p-5">
          <ChartHead title="Payment mix" sub="Share of net sales" />
          <Donut segments={paySegments} />
        </Card>

        <Card className="p-5">
          <ChartHead title="What the brain read" sub="Inputs behind this plan" />
          <div className="space-y-2 text-sm">
            <ReadRow label="Days of history" value={`${s.date_range.days}`} />
            <ReadRow label="Orders analyzed" value={formatNumber(s.order_count)} />
            <ReadRow label="Net sales (history)" value={formatCurrency(s.total_net_sales)} />
            <ReadRow label="Voids" value={`${s.voids.count} · ${formatCurrency(s.voids.amount)}`} />
            {campaign.context?.located && (
              <>
                <ReadRow label="Location" value={campaign.context.location_label || "—"} />
                <ReadRow
                  label="Live forecast"
                  value={`${campaign.context.forecast_days} days · avg ${campaign.context.avg_temp_f}°`}
                />
                {campaign.context.seasonal_days > 0 && (
                  <ReadRow
                    label="Seasonal normals"
                    value={`${campaign.context.seasonal_days} days (est.)`}
                  />
                )}
                <ReadRow label="Event days" value={`${campaign.context.event_days}`} />
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BeforeAfter({
  baseline,
  projected,
  incremental,
  brand,
}: {
  baseline: number;
  projected: number;
  incremental: number;
  brand: string;
}) {
  const max = Math.max(baseline, projected, 1);
  return (
    <div className="flex items-end gap-6">
      <Bar label="Last 30 days" value={baseline} pct={(baseline / max) * 100} color="var(--border-strong)" />
      <Bar
        label="Projected"
        value={projected}
        pct={(projected / max) * 100}
        color={brand}
        badge={`+${formatCompactCurrency(incremental)}`}
      />
    </div>
  );
}

function Bar({
  label,
  value,
  pct,
  color,
  badge,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="mb-1 text-sm font-semibold tabular-nums">{formatCompactCurrency(value)}</div>
      <div className="relative flex h-32 w-full items-end">
        <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(pct, 4)}%`, background: color }}>
          {badge && (
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full rounded-full bg-mint-500/15 px-2 py-0.5 text-[11px] font-semibold text-mint-600">
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="mt-1.5 text-xs text-fg-subtle">{label}</div>
    </div>
  );
}

function MiniStat({
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
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-fg-subtle" style={{ color: brand }}>
        {icon}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-xs text-fg-subtle">{label}</div>
    </div>
  );
}

function ChartHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-fg-subtle">{sub}</div>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1 last:border-0">
      <span className="text-fg-muted">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
