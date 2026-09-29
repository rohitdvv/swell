"use client";

import * as React from "react";
import { Users, Info } from "lucide-react";
import { Card } from "@/components/ui";
import type { CampaignWithDays } from "@/lib/types";
import { trainSalesModel } from "@/lib/model";
import { planStaffing, DEFAULT_STAFFING, DAYPART_HOURS } from "@/lib/staffing";
import { formatCompactCurrency, dowShort, formatShortDate } from "@/lib/utils";

export function StaffingPanel({ campaign }: { campaign: CampaignWithDays }) {
  const model = React.useMemo(() => trainSalesModel(campaign.sales_summary), [campaign.sales_summary]);
  const [splh, setSplh] = React.useState(DEFAULT_STAFFING.splh);
  const [wage, setWage] = React.useState(DEFAULT_STAFFING.wage);
  const [minCrew, setMinCrew] = React.useState(DEFAULT_STAFFING.minCrew);

  const plan = React.useMemo(
    () =>
      model
        ? planStaffing({ model, sales: campaign.sales_summary, days: campaign.days, assumptions: { splh, wage, minCrew } })
        : null,
    [model, campaign.sales_summary, campaign.days, splh, wage, minCrew]
  );

  if (!plan) {
    return (
      <Card className="p-6 text-sm text-fg-muted">
        Staffing needs at least 14 days of daily sales history. Upload a longer export to get a labor plan.
      </Card>
    );
  }

  const maxHours = Math.max(...plan.days.flatMap((d) => d.dayparts.map((x) => x.hours)), 1);
  const maxDay = Math.max(...plan.days.map((d) => d.hours), plan.flatHours, 1);

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4" style={{ color: "var(--os-amber)" }} /> Staffing plan from your forecast
            </div>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-pretty">
              Crewing every day the same means paying for{" "}
              <span className="font-semibold" style={{ color: "var(--os-mint)" }}>
                ~{Math.round(plan.trimHours)} labor hours ({formatCompactCurrency(plan.trimValue)})
              </span>{" "}
              on quiet days this month — and running{" "}
              <span className="font-semibold" style={{ color: "var(--os-amber)" }}>~{Math.round(plan.addHours)} hours short</span>{" "}
              on busy ones. This plan moves those hours to where the guests are.
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-fg-subtle text-pretty">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Staffed to the high end of each day&apos;s 80% forecast range plus the guests each promo is projected to
              bring, so shifts are rarely short. Compared with a flat schedule sized for this month&apos;s average day.
            </p>
          </div>
          <div className="grid w-full shrink-0 gap-3 text-xs sm:w-64">
            <label className="block">
              <span className="flex justify-between text-fg-muted">
                Sales per labor hour <span className="font-mono text-fg">${splh}</span>
              </span>
              <input type="range" min={35} max={90} step={5} value={splh} onChange={(e) => setSplh(+e.target.value)} className="mt-1 w-full accent-[var(--os-amber)]" />
            </label>
            <label className="flex items-center justify-between gap-2 text-fg-muted">
              Hourly wage (loaded)
              <input
                type="number"
                min={8}
                max={60}
                value={wage}
                onChange={(e) => setWage(Math.min(60, Math.max(8, +e.target.value || DEFAULT_STAFFING.wage)))}
                className="w-20 rounded border border-border bg-surface px-2 py-1 text-right font-mono text-fg"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-fg-muted">
              Minimum crew on shift
              <select
                value={minCrew}
                onChange={(e) => setMinCrew(+e.target.value)}
                className="w-20 rounded border border-border bg-surface px-2 py-1 text-right font-mono text-fg"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] text-fg-subtle">
              <th className="px-4 py-2.5 font-medium">Day</th>
              {plan.open.map((dp) => (
                <th key={dp} className="px-2 py-2.5 font-medium">
                  {dp} <span className="font-mono text-[10px]">({DAYPART_HOURS[dp]}h)</span>
                </th>
              ))}
              <th className="px-4 py-2.5 font-medium">Labor hours vs flat</th>
            </tr>
          </thead>
          <tbody>
            {plan.days.map((d) => {
              const delta = d.hours - d.flatHours;
              return (
                <tr key={d.date} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[11px] text-fg-muted">
                    {dowShort(d.date)} {formatShortDate(d.date)}
                  </td>
                  {d.dayparts.map((x) => (
                    <td key={x.daypart} className="px-2 py-1.5">
                      <span
                        className="inline-block min-w-[46px] rounded px-1.5 py-0.5 text-center font-mono tabular-nums"
                        style={{ background: `rgba(200,75,20,${0.06 + 0.3 * (x.hours / maxHours)})` }}
                        title={`${formatCompactCurrency(x.sales)} expected (high end) → ${x.hours} labor hours`}
                      >
                        {x.hours}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="relative h-2 w-28 rounded bg-surface-2">
                        <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(d.hours / maxDay) * 100}%`, background: delta < 0 ? "var(--os-mint)" : "var(--os-amber)" }} />
                        <div className="absolute inset-y-[-3px] w-px bg-fg" style={{ left: `${(d.flatHours / maxDay) * 100}%` }} />
                      </div>
                      <span className="w-14 text-right font-mono text-[11px] tabular-nums" style={{ color: delta < 0 ? "var(--os-mint)" : "var(--os-amber)" }}>
                        {delta > 0 ? "+" : ""}
                        {Math.round(delta)}h
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
