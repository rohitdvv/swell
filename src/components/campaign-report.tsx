"use client";

import type { CampaignWithDays } from "@/lib/types";
import { DAYPARTS } from "@/lib/types";
import { Card } from "@/components/ui";
import { BarChart, HBars, AreaSpark, Donut } from "@/components/charts";
import { ValidationCard } from "@/components/projection-panel";
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
  return (
    <div className="space-y-5">
      {/* The money headline lives above the tabs — this tab explains it. */}
      <ValidationCard campaign={campaign} />

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
