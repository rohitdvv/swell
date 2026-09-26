import type { CampaignDay, DailySales, Daypart } from "./types";
import type { SalesModel } from "./model";

// ============================================================
// Proof — did the campaign actually make money?
//
// The thing a chatbot can't do: close the loop on the owner's own register.
// After the campaign runs, the owner uploads the same POS export. We compare
// what happened with what the forecasting model — trained only on the sales
// BEFORE the campaign — says would have happened without it (the
// counterfactual). The gap is the measured lift, reported with an 80% range
// built from the model's own calibrated (conformal) per-day intervals.
//
// A second, more direct read: for each promo, units of that dish sold inside
// its window vs the same weekday + window before the campaign.
//
// Pure functions, no I/O — unit-tested in test/proof.test.ts.
// ============================================================

export type ItemLine = { date: string; daypart: Daypart | null; item: string; qty: number; net: number };

export type WindowRead = {
  date: string;
  item: string;
  daypart: Daypart;
  sold: number;
  /** Mean units on the same weekday + window before the campaign; null when the export has no history. */
  usual: number | null;
};

export type ProofReport = {
  measured_at: string;
  /** Campaign days present in the uploaded export. */
  days_covered: number;
  actual: number;
  counterfactual: number;
  lift: number;
  low80: number;
  high80: number;
  /** What Swell projected for the same days, for an honest side-by-side. */
  projected: number;
  daily: Array<{ date: string; actual: number; expected: number }>;
  windows: WindowRead[];
  window_totals: { days: number; sold: number; usual: number } | null;
  verdict: "proven" | "promising" | "too-early" | "no-lift";
};

const Z80 = 1.2816;
const MIN_DAYS = 7;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const dowOf = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();

export function measureProof(input: {
  model: SalesModel;
  days: CampaignDay[];
  after: DailySales[];
  lines: ItemLine[];
  campaignStart: string;
  now?: Date;
}): ProofReport {
  const { model, days, after, lines, campaignStart } = input;
  const byDate = new Map(after.map((d) => [d.date, d.net_sales]));
  const campaignDays = days.filter((d) => byDate.has(d.date)).sort((a, b) => a.date.localeCompare(b.date));

  // ---- revenue vs counterfactual ---------------------------------
  let actual = 0;
  let counterfactual = 0;
  let variance = 0;
  const daily: ProofReport["daily"] = [];
  for (const d of campaignDays) {
    const a = byDate.get(d.date)!;
    const e = model.predict(d.date);
    const iv = model.predictInterval(d.date, 0.8);
    const sd = (iv.high - iv.low) / 2 / Z80; // per-day spread implied by the calibrated band
    actual += a;
    counterfactual += e;
    variance += sd * sd;
    daily.push({ date: d.date, actual: Math.round(a), expected: Math.round(e) });
  }
  const lift = actual - counterfactual;
  const half = Z80 * Math.sqrt(variance);
  const projected = campaignDays.reduce((s, d) => s + d.projected_revenue, 0);

  // ---- promo windows: the dish, in its window, vs usual ------------
  const units = new Map<string, number>(); // date|item|daypart → qty
  for (const l of lines) {
    if (!l.daypart) continue;
    const k = `${l.date}|${norm(l.item)}|${l.daypart}`;
    units.set(k, (units.get(k) ?? 0) + l.qty);
  }
  const preDates = [...new Set(lines.map((l) => l.date))].filter((d) => d < campaignStart);
  const windows: WindowRead[] = campaignDays.map((d) => {
    const item = norm(d.item);
    const sold = units.get(`${d.date}|${item}|${d.daypart}`) ?? 0;
    const same = preDates.filter((p) => dowOf(p) === dowOf(d.date));
    const usual = same.length
      ? same.reduce((s, p) => s + (units.get(`${p}|${item}|${d.daypart}`) ?? 0), 0) / same.length
      : null;
    return { date: d.date, item: d.item, daypart: d.daypart, sold, usual: usual == null ? null : Math.round(usual * 10) / 10 };
  });
  const withBase = windows.filter((w) => w.usual != null);
  const window_totals = withBase.length
    ? {
        days: withBase.length,
        sold: withBase.reduce((s, w) => s + w.sold, 0),
        usual: Math.round(withBase.reduce((s, w) => s + (w.usual ?? 0), 0)),
      }
    : null;

  const verdict: ProofReport["verdict"] =
    campaignDays.length < MIN_DAYS
      ? "too-early"
      : lift - half > 0
        ? "proven"
        : lift > 0
          ? "promising"
          : "no-lift";

  return {
    measured_at: (input.now ?? new Date()).toISOString(),
    days_covered: campaignDays.length,
    actual: Math.round(actual),
    counterfactual: Math.round(counterfactual),
    lift: Math.round(lift),
    low80: Math.round(lift - half),
    high80: Math.round(lift + half),
    projected: Math.round(projected),
    daily,
    windows,
    window_totals,
    verdict,
  };
}
