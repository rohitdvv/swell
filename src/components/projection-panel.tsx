"use client";

import * as React from "react";
import {
  TrendingUp,
  ArrowUpRight,
  Ticket,
  Utensils,
  ShieldCheck,
  Check,
  X,
  Info,
} from "lucide-react";
import type { CampaignWithDays } from "@/lib/types";
import type { Basis, ProjectionValidation } from "@/lib/validate";
import { validateProjection } from "@/lib/validate";
import { Card } from "@/components/ui";
import { formatCompactCurrency, formatCurrency, formatNumber } from "@/lib/utils";

export function useValidation(campaign: CampaignWithDays): ProjectionValidation {
  return React.useMemo(() => validateProjection(campaign), [campaign]);
}

const CONFIDENCE_TONE: Record<ProjectionValidation["confidence"], string> = {
  high: "bg-mint-500/15 text-mint-600",
  moderate: "bg-amber-500/15 text-amber-600",
  low: "bg-rose-500/15 text-rose-600",
};

/**
 * The money question, answered before anything else on the screen: what did
 * the last 30 days earn, what should the next 30 earn, and how sure are we.
 */
export function MoneyHeadline({ campaign }: { campaign: CampaignWithDays }) {
  const brand = campaign.brand?.primary_color || "#f75410";
  const v = useValidation(campaign);
  const s = campaign.sales_summary;

  const projectedTotal = v.baseline + v.expected;
  const totalRed = campaign.days.reduce((a, d) => a + d.projected_redemptions, 0);
  const totalCovers = campaign.days.reduce((a, d) => a + (d.expected_covers || 0), 0);

  return (
    <Card className="mb-5 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TrendingUp className="size-4" style={{ color: brand }} />
        <span className="text-sm font-semibold">Last 30 days → projected next 30</span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
          style={{ background: brand }}
        >
          <ArrowUpRight className="size-3" /> +{v.upliftPct.toFixed(1)}%
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${CONFIDENCE_TONE[v.confidence]}`}
          title={v.confidenceReason}
        >
          {v.confidence} confidence
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col justify-center">
          {/* The two numbers, side by side — no chart-junk, no overlap. */}
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-xs text-fg-subtle">Last 30 days</div>
              <div className="font-display text-3xl tabular-nums text-fg-muted">
                {formatCompactCurrency(v.baseline)}
              </div>
            </div>
            <ArrowUpRight className="size-5 shrink-0 self-center text-fg-subtle" />
            <div>
              <div className="text-xs text-fg-subtle">Projected next 30</div>
              <div className="font-display text-4xl tabular-nums" style={{ color: brand }}>
                {formatCompactCurrency(projectedTotal)}
              </div>
            </div>
          </div>

          {/* Runway: baseline flows into the glowing lift segment. */}
          <Runway baseline={v.baseline} lift={v.expected} brand={brand} />
          <RangeBar low={v.low} expected={v.expected} high={v.high} brand={brand} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniStat
            icon={<TrendingUp className="size-4" />}
            label="Projected incremental"
            value={formatCompactCurrency(v.expected)}
            brand={brand}
          />
          <MiniStat
            icon={<Ticket className="size-4" />}
            label="Projected redemptions"
            value={formatNumber(totalRed)}
            brand={brand}
          />
          <MiniStat
            icon={<Utensils className="size-4" />}
            label="Covers to prep (30d)"
            value={formatNumber(totalCovers)}
            brand={brand}
          />
          <MiniStat
            icon={<ArrowUpRight className="size-4" />}
            label="Avg check"
            value={formatCurrency(s.total_net_sales / Math.max(1, s.order_count))}
            brand={brand}
          />
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-subtle">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span className="text-pretty">{v.confidenceReason}</span>
      </p>
    </Card>
  );
}

/**
 * Baseline flowing into the campaign lift as one horizontal runway.
 * The lift segment is drawn with a minimum width so a 3% lift is still
 * visible, and its true share is stated in the chip — never faked silently.
 */
function Runway({ baseline, lift, brand }: { baseline: number; lift: number; brand: string }) {
  const total = Math.max(baseline + lift, 1);
  const liftShare = Math.max((lift / total) * 100, 6); // visual floor, labeled honestly
  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-fg-subtle">Your run-rate + campaign lift</span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{ background: brand }}
        >
          +{formatCompactCurrency(lift)} lift
        </span>
      </div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-l-full bg-border-strong/70"
          style={{ width: `${100 - liftShare}%` }}
        />
        <div
          className="h-full rounded-r-full"
          style={{
            width: `${liftShare}%`,
            background: `linear-gradient(90deg, ${brand}, var(--color-rose-accent))`,
            boxShadow: `0 0 14px ${brand}80`,
          }}
        />
      </div>
    </div>
  );
}

/** The projected range, drawn to scale, with the expected case marked. */
function RangeBar({
  low,
  expected,
  high,
  brand,
}: {
  low: number;
  expected: number;
  high: number;
  brand: string;
}) {
  const span = Math.max(high - low, 1);
  const markerPct = ((expected - low) / span) * 100;
  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-fg-subtle">Incremental revenue, low → high</span>
        <span className="font-medium tabular-nums">
          {formatCompactCurrency(low)} – {formatCompactCurrency(high)}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-surface-2">
        <div
          className="absolute inset-y-0 rounded-full opacity-30"
          style={{ left: 0, right: 0, background: brand }}
        />
        <div
          className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-surface"
          style={{ left: `${Math.min(96, Math.max(4, markerPct))}%`, background: brand }}
          title={`Expected ${formatCompactCurrency(expected)}`}
        />
      </div>
    </div>
  );
}

const BASIS_TONE: Record<Basis, string> = {
  measured: "bg-mint-500/15 text-mint-600",
  assumed: "bg-amber-500/15 text-amber-600",
  simulated: "bg-violet-500/15 text-violet-500",
};

/**
 * Every number the projection rests on, labelled by where it came from, plus
 * the checks we actually ran against the generated plan.
 */
export function ValidationCard({ campaign }: { campaign: CampaignWithDays }) {
  const brand = campaign.brand?.primary_color || "#f75410";
  const v = useValidation(campaign);
  const failed = v.checks.filter((c) => !c.ok).length;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="size-4" style={{ color: brand }} />
        <div>
          <div className="text-sm font-semibold">Projection &amp; validation</div>
          <div className="text-xs text-fg-subtle">
            Where every number came from, and what we checked
          </div>
        </div>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
            failed ? "bg-rose-500/15 text-rose-600" : "bg-mint-500/15 text-mint-600"
          }`}
        >
          {failed ? `${failed} check${failed === 1 ? "" : "s"} failed` : `${v.checks.length}/${v.checks.length} checks passed`}
        </span>
      </div>

      <div className="space-y-1.5">
        {v.checks.map((c) => (
          <div key={c.label} className="flex items-start gap-2.5 text-sm">
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
                c.ok ? "bg-mint-500/15 text-mint-600" : "bg-rose-500/15 text-rose-600"
              }`}
            >
              {c.ok ? <Check className="size-2.5" /> : <X className="size-2.5" />}
            </span>
            <span className="text-fg">{c.label}</span>
            <span className="ml-auto text-right text-xs text-fg-subtle">{c.detail}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        Assumptions
      </div>
      <div className="space-y-2.5">
        {v.assumptions.map((a) => (
          <div key={a.label} className="border-b border-border pb-2.5 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium">{a.label}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BASIS_TONE[a.basis]}`}
              >
                {a.basis}
              </span>
              <span className="ml-auto text-sm tabular-nums text-fg-muted">{a.value}</span>
            </div>
            <p className="mt-1 text-xs text-fg-subtle text-pretty">{a.note}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-subtle text-pretty">
        <span className="font-medium text-fg-muted">How the range is built. </span>
        {v.bandReason}
      </p>
    </Card>
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
      <div className="flex items-center gap-1.5" style={{ color: brand }}>
        {icon}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-xs text-fg-subtle">{label}</div>
    </div>
  );
}
