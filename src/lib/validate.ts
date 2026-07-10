import type { Campaign, CampaignDay } from "./types";
import { projectDay, BASE_SCENARIO, type ProjectionScenario } from "./project";

// ============================================================
// Projection validation
//
// A single projected number is a guess wearing a suit. This module does two
// things instead:
//
//   1. Derives a range by re-running the *same* projection under pessimistic
//      and optimistic values of the two inputs we cannot measure from a POS
//      export (response rate, incrementality). The band is a sensitivity
//      analysis, not a decorative ±.
//   2. Runs real checks against the generated plan and reports what failed.
//
// Nothing here is cosmetic. If a number came from an assumption, it says so.
// ============================================================

export type Basis = "measured" | "assumed" | "simulated";

export type Assumption = {
  label: string;
  value: string;
  basis: Basis;
  note: string;
};

export type Check = {
  label: string;
  ok: boolean;
  detail: string;
};

export type ProjectionValidation = {
  low: number;
  expected: number;
  high: number;
  baseline: number;
  /** Uplift over baseline at the expected case, as a percentage. */
  upliftPct: number;
  confidence: "low" | "moderate" | "high";
  confidenceReason: string;
  /** Why the band is as wide as it is. */
  bandReason: string;
  assumptions: Assumption[];
  checks: Check[];
};

/**
 * How far the unmeasurable inputs are allowed to swing. These are the honest
 * edges of the model, widened when we have less history to stand on.
 */
const RESPONSE_SPREAD = 0.4; // ±40% on the modeled response rate
const INCREMENTALITY_LOW = 0.4;
const INCREMENTALITY_HIGH = 0.7;

/** Thin history is thin evidence — widen the band rather than pretend. */
function volumeFactor(dataDays: number): number {
  if (dataDays <= 0) return 1.5;
  return Math.min(1.5, Math.max(1, Math.sqrt(30 / dataDays)));
}

function totalUnder(
  campaign: Campaign,
  days: CampaignDay[],
  scenario: ProjectionScenario
): number {
  let sum = 0;
  for (const d of days) {
    sum += projectDay(
      campaign.sales_summary,
      campaign.marketplace,
      d.dow,
      d.daypart,
      d.pct_off,
      scenario
    ).projected_revenue;
  }
  return Math.round(sum);
}

export function validateProjection(
  campaign: Campaign & { days: CampaignDay[] }
): ProjectionValidation {
  const days = campaign.days;
  const sales = campaign.sales_summary;
  const dataDays = sales?.date_range?.days ?? 0;
  const vf = volumeFactor(dataDays);

  const spread = Math.min(0.75, RESPONSE_SPREAD * vf);
  const expected = days.reduce((a, d) => a + d.projected_revenue, 0);
  const low = totalUnder(campaign, days, {
    responseScale: 1 - spread,
    incrementality: INCREMENTALITY_LOW,
  });
  const high = totalUnder(campaign, days, {
    responseScale: 1 + spread,
    incrementality: INCREMENTALITY_HIGH,
  });

  const baseline = campaign.baseline_revenue;
  const upliftPct = baseline > 0 ? (expected / baseline) * 100 : 0;

  // ---- confidence ----
  const simulatedDemand = campaign.marketplace?.simulated !== false;
  const located = !!campaign.context?.located;
  const seasonal = campaign.context?.seasonal_days ?? 0;

  let confidence: ProjectionValidation["confidence"];
  let confidenceReason: string;
  if (dataDays < 21) {
    confidence = "low";
    confidenceReason = `Only ${dataDays} days of sales history — too short to separate a real daypart pattern from noise. Upload 60+ days to tighten this.`;
  } else if (simulatedDemand) {
    // The honest ceiling: demand signals are modeled until the consumer app is live.
    confidence = "moderate";
    confidenceReason = `${dataDays} days of history is enough to read your dayparts, but the demand multiplier is still modeled rather than observed. Confidence is capped at moderate until Swell has real saves and redemptions for this venue.`;
  } else if (dataDays >= 60 && located) {
    confidence = "high";
    confidenceReason = `${dataDays} days of history, live local conditions, and observed marketplace demand all agree.`;
  } else {
    confidence = "moderate";
    confidenceReason = `${dataDays} days of history${located ? "" : " and no location, so no weather or event signal"}.`;
  }

  const bandParts = [
    `The two inputs a POS export can't tell us — how many guests respond to an offer, and how much of that revenue is genuinely new — are swung to their pessimistic and optimistic edges.`,
  ];
  if (vf > 1.01) {
    bandParts.push(
      `The band is widened ${Math.round((vf - 1) * 100)}% because ${dataDays} days of history is less than the 30 the model prefers.`
    );
  }

  // ---- checks: run against the actual generated plan ----
  const checks: Check[] = [];

  checks.push({
    label: "Full 30-day plan",
    ok: days.length === 30,
    detail: `${days.length} days generated`,
  });

  const outOfBand = days.filter((d) => d.pct_off < 10 || d.pct_off > 45);
  checks.push({
    label: "Discounts inside the 10–45% guardrail",
    ok: outOfBand.length === 0,
    detail: outOfBand.length
      ? `${outOfBand.length} day(s) outside the band`
      : "every day within band",
  });

  // Redemptions must never exceed the covers we expect through the door.
  const overbooked = days.filter(
    (d) => d.expected_covers > 0 && d.projected_redemptions > d.expected_covers
  );
  checks.push({
    label: "Redemptions never exceed expected covers",
    ok: overbooked.length === 0,
    detail: overbooked.length
      ? `${overbooked.length} day(s) project more redemptions than covers`
      : "no day projects more offers redeemed than guests served",
  });

  const withWeather = days.filter((d) => d.weather).length;
  const live = days.filter((d) => d.weather?.source === "forecast").length;
  checks.push({
    label: "Weather on every day",
    ok: withWeather === days.length && days.length > 0,
    detail: located
      ? `${withWeather}/${days.length} days — ${live} live forecast, ${seasonal} seasonal estimate`
      : "no location given, so the plan is sales-history only",
  });

  const eventDays = days.filter((d) => d.event).length;
  checks.push({
    label: "Local events checked",
    ok: located,
    detail: located
      ? `${eventDays} day(s) hooked to a real nearby event or holiday`
      : "no location given",
  });

  const longCopy = days.filter((d) => d.copy.length > 80);
  checks.push({
    label: "Every caption under 80 characters",
    ok: longCopy.length === 0,
    detail: longCopy.length ? `${longCopy.length} caption(s) too long` : `${days.length}/${days.length} within limit`,
  });

  checks.push({
    label: "Uplift is a plausible size",
    ok: upliftPct > 0 && upliftPct < 25,
    detail:
      upliftPct >= 25
        ? `+${upliftPct.toFixed(1)}% over baseline is implausibly large — check the sales export`
        : `+${upliftPct.toFixed(1)}% over a ${fmt(baseline)} baseline`,
  });

  // ---- assumptions: every unmeasured number, labelled ----
  const assumptions: Assumption[] = [
    {
      label: "Baseline revenue",
      value: fmt(baseline),
      basis: "measured",
      note: `Your own net sales over ${dataDays} days, scaled to 30.`,
    },
    {
      label: "Reachable guests per promo",
      value: "day-of-week orders × daypart share",
      basis: "measured",
      note: "Taken directly from your POS export, not an industry average.",
    },
    {
      label: "Response rate",
      value: `12% + 0.7 × discount (${Math.round((0.12 + 0.275 * 0.7) * 100)}% at 27.5% off)`,
      basis: "assumed",
      note: "No restaurant can measure this before running the offer. Swung ±" + Math.round(spread * 100) + "% to build the range.",
    },
    {
      label: "Incrementality",
      value: `${Math.round(BASE_SCENARIO.incrementality * 100)}% of promo revenue is new`,
      basis: "assumed",
      note: `The rest would have walked in anyway. Range tested: ${Math.round(INCREMENTALITY_LOW * 100)}–${Math.round(INCREMENTALITY_HIGH * 100)}%.`,
    },
    {
      label: "Demand multiplier",
      value: `${campaign.marketplace?.lift_factor?.toFixed(2) ?? "1.00"}×`,
      basis: simulatedDemand ? "simulated" : "measured",
      note: simulatedDemand
        ? "Modeled preview — Swell's consumer app has no real saves or redemptions for this venue yet."
        : "Observed saves and redemptions from the Swell marketplace.",
    },
    {
      label: "Weather signal",
      value: located ? `${live} forecast + ${seasonal} seasonal days` : "none",
      basis: located ? (seasonal > 0 ? "assumed" : "measured") : "assumed",
      note: located
        ? seasonal > 0
          ? `Days past the 16-day forecast use the 5-year average for that date, and move the discount half as far.`
          : "Every day sits inside the live forecast horizon."
        : "No location given, so no weather adjustment was applied.",
    },
  ];

  return {
    low,
    expected,
    high,
    baseline,
    upliftPct,
    confidence,
    confidenceReason,
    bandReason: bandParts.join(" "),
    assumptions,
    checks,
  };
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
