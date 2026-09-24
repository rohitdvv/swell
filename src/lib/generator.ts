import "server-only";
import { randomUUID } from "node:crypto";
import type {
  ParsedSalesSummary,
  BrandKit,
  MarketplaceSignals,
  Campaign,
  CampaignDay,
  Daypart,
  DayOfWeek,
  AgentEvent,
} from "./types";
import { DAYPARTS, DAYPART_WINDOWS } from "./types";
import { generateCopyBatch, type CopyInput } from "./copy";
import { projectDay } from "./project";
import { trainSalesModel, modelSummary } from "./model";
import { EMPTY_CONTEXT, type CampaignContext } from "./context";
import {
  addDays,
  toISODate,
  dowShort,
  dowFull,
  monthLabel,
  monthSlug,
  seededUnit,
  clamp,
  slugify,
} from "./utils";

export const CAMPAIGN_LEN = 30;

export type ItemScore = {
  name: string;
  qty: number;
  net: number;
  price: number;
  pmix: number; // 0..1 share of quantity
  hero: number; // 0..1 signature/premium score
  trial: number; // 0..1 broad-appeal score
};

export type DaypartAnalysis = {
  daypart: Daypart;
  net: number;
  orders: number;
  z: number;
  slowness: number; // higher = slower vs peers
  operating: boolean;
  weight: number; // scheduling weight
};

export type SalesAnalysis = {
  daypartAnalysis: DaypartAnalysis[];
  operating: DaypartAnalysis[];
  items: ItemScore[];
};

export type RawDay = Omit<CampaignDay, "copy" | "creative_url">;

export type StrategyMeta = {
  band: [number, number];
  heroMode: boolean;
  rankedItems: ItemScore[];
  slowNames: Daypart[];
  heroNames: string[];
};

/**
 * Campaigns cover the *next 30 days starting today* — so the near-term days
 * fall inside the live weather-forecast horizon (~16 days out). The remaining
 * days are covered by climate normals, marked as estimates.
 */
export function defaultStartDate(): string {
  return toISODate(new Date());
}

// ============================================================
// ANALYST — z-score dayparts + score items
// ============================================================
function scoreItems(sales: ParsedSalesSummary): ItemScore[] {
  const items = sales.top_items.filter((i) => i.qty > 0 && i.net_sales > 0);
  if (items.length === 0) {
    return ["House Special", "Signature Plate", "Daily Feature", "Chef's Pick"].map(
      (name, idx) => ({
        name,
        qty: 10,
        net: 200,
        price: 20,
        pmix: 0.25,
        hero: idx < 2 ? 0.8 : 0.5,
        trial: 0.6,
      })
    );
  }
  const totalQty = items.reduce((a, b) => a + b.qty, 0) || 1;
  const prices = items.map((i) => i.net_sales / Math.max(1, i.qty));
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const maxQty = Math.max(...items.map((i) => i.qty));

  return items.map((i) => {
    const price = i.net_sales / Math.max(1, i.qty);
    const priceNorm = maxPrice === minPrice ? 0.5 : (price - minPrice) / (maxPrice - minPrice);
    const pmix = i.qty / totalQty;
    const qtyNorm = i.qty / maxQty;
    return {
      name: i.name,
      qty: i.qty,
      net: i.net_sales,
      price,
      pmix,
      hero: clamp(0.65 * priceNorm + 0.35 * qtyNorm, 0, 1),
      trial: clamp(0.7 * qtyNorm + 0.3 * (1 - Math.abs(priceNorm - 0.5) * 2), 0, 1),
    };
  });
}

function analyzeDayparts(sales: ParsedSalesSummary, totalOrders: number): DaypartAnalysis[] {
  const rows = DAYPARTS.map((dp) => ({
    daypart: dp,
    net: sales.by_daypart[dp].net_sales,
    orders: sales.by_daypart[dp].orders,
  }));
  const operatingThreshold = Math.max(5, totalOrders * 0.02);
  const operating = rows.filter((r) => r.orders >= operatingThreshold);
  const revs = operating.map((r) => r.net);
  const mean = revs.reduce((a, b) => a + b, 0) / (revs.length || 1);
  const variance = revs.reduce((a, b) => a + (b - mean) ** 2, 0) / (revs.length || 1);
  const std = Math.sqrt(variance) || 1;

  return rows.map((r) => {
    const isOp = r.orders >= operatingThreshold;
    const z = isOp ? (r.net - mean) / std : 0;
    const slowness = isOp ? clamp(-z, -2, 2) : -Infinity;
    return {
      ...r,
      z: Math.round(z * 100) / 100,
      slowness,
      operating: isOp,
      weight: isOp ? Math.exp(slowness * 0.9) : 0,
    };
  });
}

export function analyzeSales(sales: ParsedSalesSummary): SalesAnalysis {
  const totalOrders = sales.order_count || 1;
  const daypartAnalysis = analyzeDayparts(sales, totalOrders);
  return {
    daypartAnalysis,
    operating: daypartAnalysis.filter((d) => d.operating),
    items: scoreItems(sales),
  };
}

// ============================================================
// STRATEGY — assemble the 30-day plan
// ============================================================
function discountBand(organic: number): [number, number] {
  if (organic > 0.6) return [15, 25];
  if (organic < 0.42) return [25, 40];
  return [20, 30];
}

// Item ↔ weather affinity — which dishes suit cold/wet vs warm days.
const COMFORT_RE =
  /(pasta|ragu|ragù|risotto|soup|zuppa|stew|braised|lasagn|gnocchi|cacio|bucatini|tagliatelle|amatriciana|carbonara|meatball|truffle|cheese|fonduta|pizza|hot|mac|polenta|parm)/i;
const LIGHT_RE =
  /(salad|insalata|caprese|burrata|spritz|aperol|negroni|crudo|ceviche|branzino|sea|oyster|gazpacho|sorbet|iced|cold|greens|prosecco|ros[eé]|spritz|tartare|melon|citrus|chianti|espresso)/i;

function itemAffinity(name: string): "comfort" | "light" | null {
  if (COMFORT_RE.test(name)) return "comfort";
  if (LIGHT_RE.test(name)) return "light";
  return null;
}

function desiredAffinity(
  weather: CampaignContext["byDate"][string]["weather"]
): "comfort" | "light" | null {
  if (!weather) return null;
  if (weather.wet || weather.bucket === "cold" || weather.bucket === "cool") return "comfort";
  if (weather.bucket === "hot" || weather.bucket === "warm") return "light";
  return null;
}

function pickWeighted<T>(items: T[], weights: number[], r: number): number {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let x = r * total;
  for (let idx = 0; idx < items.length; idx++) {
    x -= weights[idx];
    if (x <= 0) return idx;
  }
  return items.length - 1;
}

export function buildDayPlan(
  sales: ParsedSalesSummary,
  brand: BrandKit,
  marketplace: MarketplaceSignals,
  analysis: SalesAnalysis,
  context: CampaignContext,
  opts: { startDate: string; campaignId: string }
): { rawDays: RawDay[]; meta: StrategyMeta } {
  const { operating, items } = analysis;
  const { startDate, campaignId } = opts;
  const [bandLo, bandHi] = discountBand(marketplace.organic_demand_index);
  const heroMode = marketplace.organic_demand_index < 0.42;
  const rankedItems = [...items].sort((a, b) =>
    heroMode ? b.hero - a.hero : b.trial - a.trial
  );

  const dataDays = Math.max(sales.date_range.days, 14);
  const dowOccurrences = Math.max(1, Math.round(dataDays / 7));

  const rawDays: RawDay[] = [];
  const recentItems: string[] = [];
  let lastDaypart: Daypart | null = null;

  for (let i = 0; i < CAMPAIGN_LEN; i++) {
    const date = addDays(startDate, i);
    const dowFullName = dowFull(date) as DayOfWeek;
    const seed = `${campaignId}:${i}`;
    const ctx = context.byDate[date] ?? { weather: null, event: null };
    const desired = desiredAffinity(ctx.weather);

    const dpWeights = operating.map((d) => d.weight);
    const dpIdx = pickWeighted(operating, dpWeights, seededUnit(seed + ":dp"));
    let chosen = operating[dpIdx];
    if (chosen.daypart === lastDaypart && operating.length > 1) {
      const alt = operating
        .map((d, idx) => ({ d, idx }))
        .filter((x) => x.d.daypart !== lastDaypart)
        .sort((a, b) => b.d.weight - a.d.weight)[0];
      if (alt) chosen = alt.d;
    }
    lastDaypart = chosen.daypart;

    // item selection — bias toward the weather-appropriate affinity,
    // then any non-recent item, else fall back to rotation.
    const rot = (k: number) => rankedItems[(k + i) % rankedItems.length];
    let item = rankedItems[i % rankedItems.length];
    if (desired) {
      for (let k = 0; k < rankedItems.length; k++) {
        const c = rot(k);
        if (!recentItems.includes(c.name) && itemAffinity(c.name) === desired) {
          item = c;
          break;
        }
      }
    }
    if (!desired || item.name === rankedItems[i % rankedItems.length].name) {
      for (let k = 0; k < rankedItems.length; k++) {
        const c = rot(k);
        if (!recentItems.includes(c.name)) {
          item = c;
          break;
        }
      }
    }
    recentItems.push(item.name);
    if (recentItems.length > 3) recentItems.shift();

    const slownessPush = clamp(chosen.slowness, 0, 2) * 4;
    const isWeekend = dowFullName === "Friday" || dowFullName === "Saturday";
    const weekendTrim = isWeekend ? -3 : 0;
    const jitter = (seededUnit(seed + ":pct") - 0.5) * 6;

    // ---- real-time context adjustments ----
    const notes: string[] = [];
    let ctxDelta = 0;
    let demandBoost = 1;
    if (ctx.weather) {
      const w = ctx.weather;
      // A seasonal normal is a weaker signal than a real forecast, so it moves
      // the discount half as far.
      const est = w.source === "seasonal";
      const conf = est ? 0.5 : 1;
      const tag = est ? " (seasonal est.)" : "";
      if (w.wet) {
        ctxDelta += 5 * conf; // rain suppresses walk-ins → sweeten to pull them out
        demandBoost *= est ? 0.95 : 0.9;
        notes.push(
          `${w.icon} ${w.condition} ${w.tempF}°${tag} — deeper offer + comfort pick to beat the rain`
        );
      } else if (w.bucket === "cold" || w.bucket === "cool") {
        ctxDelta += 3 * conf;
        notes.push(`${w.icon} ${w.tempF}°${tag} — warming, hearty feature`);
      } else if (w.bucket === "hot" || w.bucket === "warm") {
        demandBoost *= est ? 1.025 : 1.05;
        notes.push(`${w.icon} ${w.tempF}°${tag} — bright, lighter feature for patio weather`);
      } else {
        notes.push(`${w.icon} ${w.condition} ${w.tempF}°${tag}`);
      }
    }
    if (ctx.event) {
      ctxDelta -= 5; // demand is already there → protect margin
      demandBoost *= 1.18;
      notes.push(
        `${ctx.event.type === "holiday" ? "🎉" : "🎫"} ${ctx.event.name} nearby — protect margin, feature a hero`
      );
    }

    let pct = bandLo + (bandHi - bandLo) * 0.4 + slownessPush + weekendTrim + jitter + ctxDelta;
    pct = clamp(Math.round(pct / 5) * 5, 10, 45);

    const { projected_redemptions, projected_revenue } = projectDay(
      sales,
      marketplace,
      dowFullName,
      chosen.daypart,
      pct
    );

    // whole-day covers for a prep / inventory hint
    const baseCovers = (sales.by_dayofweek[dowFullName]?.orders ?? 0) / dowOccurrences;
    const expected_covers = Math.max(0, Math.round(baseCovers * demandBoost));

    const context_note = notes.length ? notes.join(" · ") : null;

    rawDays.push({
      id: randomUUID(),
      campaign_id: campaignId,
      day_index: i,
      date,
      dow: dowFullName,
      daypart: chosen.daypart,
      discount_window: DAYPART_WINDOWS[chosen.daypart],
      item: item.name,
      pct_off: pct,
      projected_redemptions,
      projected_revenue,
      rationale: buildRationale(chosen, item, pct, marketplace, heroMode),
      weather: ctx.weather,
      event: ctx.event,
      context_note,
      expected_covers,
      edited: false,
    });
  }

  const slowNames = operating
    .filter((d) => d.slowness > 0.2)
    .sort((a, b) => b.slowness - a.slowness)
    .map((d) => d.daypart);
  const heroNames = rankedItems.slice(0, 3).map((i) => i.name);

  return {
    rawDays,
    meta: { band: [bandLo, bandHi], heroMode, rankedItems, slowNames, heroNames },
  };
}

// ============================================================
// COPYWRITER — one caption per day (LLM or deterministic + guardrail)
// ============================================================
export async function writeCopy(
  rawDays: RawDay[],
  brand: BrandKit,
  restaurantName: string,
  campaignId: string
) {
  const copyInputs: CopyInput[] = rawDays.map((d) => ({
    restaurantName,
    item: d.item,
    daypart: d.daypart,
    window: d.discount_window,
    pctOff: d.pct_off,
    dow: dowShort(d.date),
    voiceSummary: brand.voice_summary,
    voiceKeywords: brand.voice_keywords,
    seed: `${campaignId}:${d.day_index}`,
    // Let the copywriter hook the real world, not just the discount.
    event: d.event,
    weather: d.weather,
  }));
  return generateCopyBatch(copyInputs);
}

// ============================================================
// REVENUE — projections roll-up + assemble the campaign shell
// ============================================================
export function assembleCampaign(
  sales: ParsedSalesSummary,
  brand: BrandKit,
  marketplace: MarketplaceSignals,
  days: CampaignDay[],
  meta: StrategyMeta,
  context: CampaignContext,
  opts: {
    campaignId: string;
    restaurantId: string;
    startDate: string;
    location?: string | null;
    trace?: AgentEvent[];
  }
): Campaign {
  const restaurantName = brand.name || sales.restaurant_name;
  const restaurantSlug = slugify(restaurantName);
  const dataDays = Math.max(sales.date_range.days, 14);

  const projected_revenue = days.reduce((a, b) => a + b.projected_revenue, 0);
  const projected_redemptions = days.reduce((a, b) => a + b.projected_redemptions, 0);
  const baseline_revenue = Math.round((sales.total_net_sales / dataDays) * CAMPAIGN_LEN);

  const strategy_notes = buildStrategyNotes(
    meta.slowNames,
    meta.heroNames,
    marketplace,
    meta.band,
    meta.heroMode
  );
  // Learned model over the uploaded daily series (backtested — honest error).
  const learned = trainSalesModel(sales);
  if (learned) strategy_notes.unshift(modelSummary(learned));
  if (context.summary.located) {
    const s = context.summary;
    const tail = s.seasonal_days
      ? `, then ${s.seasonal_days} days of seasonal normals (typical weather for those dates, not a forecast)`
      : "";
    strategy_notes.push(
      `Reading live conditions for ${s.location_label}: ${s.forecast_days}-day live forecast${tail} — avg ${s.avg_temp_f}°, ${s.rain_days} wet days — plus ${s.event_days} local event day${s.event_days === 1 ? "" : "s"}. Offers, items & copy adapt per day.`
    );
  }

  return {
    id: opts.campaignId,
    owner_email: null, // stamped by the caller (/api/generate) — generation is owner-agnostic
    restaurant_id: opts.restaurantId,
    slug: `${restaurantSlug}-${monthSlug(opts.startDate)}`,
    restaurant_slug: restaurantSlug,
    restaurant_name: restaurantName,
    month: monthLabel(opts.startDate),
    start_date: opts.startDate,
    title: `${restaurantName} — ${monthLabel(opts.startDate).split(" ")[0]} Momentum Plan`,
    status: "draft",
    paused: true,
    projected_revenue,
    projected_redemptions,
    baseline_revenue,
    brand,
    marketplace,
    sales_summary: sales,
    strategy_notes,
    agent_trace: opts.trace ?? [],
    location: opts.location ?? null,
    context: context.summary,
    created_at: new Date().toISOString(),
    published_at: null,
  };
}

// ============================================================
// Convenience wrapper (used by tests / non-orchestrated callers)
// ============================================================
export async function generateCampaign(
  sales: ParsedSalesSummary,
  brand: BrandKit,
  marketplace: MarketplaceSignals,
  opts: { startDate?: string; restaurantId?: string } = {}
): Promise<{ campaign: Campaign; days: CampaignDay[] }> {
  const startDate = opts.startDate ?? defaultStartDate();
  const restaurantId = opts.restaurantId ?? randomUUID();
  const campaignId = randomUUID();
  const restaurantName = brand.name || sales.restaurant_name;

  const analysis = analyzeSales(sales);
  const { rawDays, meta } = buildDayPlan(sales, brand, marketplace, analysis, EMPTY_CONTEXT, {
    startDate,
    campaignId,
  });
  const copyResults = await writeCopy(rawDays, brand, restaurantName, campaignId);
  const days: CampaignDay[] = rawDays.map((d, idx) => ({
    ...d,
    copy: copyResults[idx].copy,
    creative_url: `/api/creative/${d.id}.png`,
  }));
  const campaign = assembleCampaign(sales, brand, marketplace, days, meta, EMPTY_CONTEXT, {
    campaignId,
    restaurantId,
    startDate,
  });
  return { campaign, days };
}

// ---- narrative helpers -------------------------------------
function buildRationale(
  dp: DaypartAnalysis,
  item: ItemScore,
  pct: number,
  mkt: MarketplaceSignals,
  heroMode: boolean
): string {
  const parts: string[] = [];
  if (dp.slowness > 0.2) {
    const belowPct = Math.round(clamp(dp.slowness, 0, 2) * 22);
    parts.push(`${dp.daypart} runs ~${belowPct}% under your daypart average`);
  } else {
    parts.push(`${dp.daypart} is a peak window — a light offer captures overflow`);
  }
  parts.push(
    heroMode
      ? `${item.name} is a signature plate (urgency play)`
      : `${item.name} has high menu-mix (trial play)`
  );
  parts.push(`${pct}% off · marketplace lift ×${mkt.lift_factor.toFixed(2)}`);
  return parts.join(" · ");
}

function buildStrategyNotes(
  slowDayparts: string[],
  heroItems: string[],
  mkt: MarketplaceSignals,
  band: [number, number],
  heroMode: boolean
): string[] {
  const notes: string[] = [];
  notes.push(
    slowDayparts.length
      ? `Targeting your slowest windows first: ${slowDayparts.join(", ")} (z-scored against your own daypart baseline).`
      : `Your dayparts are evenly loaded — spreading offers to lift overall frequency.`
  );
  notes.push(
    `Blending signals 70% sales history / 30% live marketplace demand (organic demand index ${mkt.organic_demand_index.toFixed(
      2
    )}).`
  );
  notes.push(
    heroMode
      ? `Organic pull is soft — leading with signature items (${heroItems
          .slice(0, 2)
          .join(", ")}) and sharper ${band[0]}–${band[1]}% offers to manufacture urgency.`
      : `Organic pull is healthy — featuring broad-appeal items (${heroItems
          .slice(0, 2)
          .join(", ")}) at protective ${band[0]}–${band[1]}% offers to drive trial without eroding margin.`
  );
  if (mkt.in_marketplace && mkt.simulated) {
    notes.push(
      `Modeled neighborhood demand (~${mkt.saves} saves, ~${mkt.past_redemptions} redemptions within ${mkt.neighborhood.radius_miles} mi, median basket $${mkt.neighborhood.median_basket}) — a design-partner preview until the Swell consumer app is live here.`
    );
  } else if (mkt.in_marketplace) {
    notes.push(
      `Reading ${mkt.saves} saves and ${mkt.past_redemptions} prior in-app redemptions within ${mkt.neighborhood.radius_miles} mi (median basket ${`$${mkt.neighborhood.median_basket}`}, ${mkt.neighborhood.dominant_age_band}).`
    );
  } else {
    notes.push(
      `Not yet in the Swell marketplace — leaning on sales history with conservative lift until live demand data flows in.`
    );
  }
  return notes;
}
