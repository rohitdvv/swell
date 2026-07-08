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

export function firstOfNextMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return toISODate(d);
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
  opts: { startDate: string; campaignId: string }
): { rawDays: RawDay[]; meta: StrategyMeta } {
  const { operating, items } = analysis;
  const { startDate, campaignId } = opts;
  const [bandLo, bandHi] = discountBand(marketplace.organic_demand_index);
  const heroMode = marketplace.organic_demand_index < 0.42;
  const rankedItems = [...items].sort((a, b) =>
    heroMode ? b.hero - a.hero : b.trial - a.trial
  );

  const rawDays: RawDay[] = [];
  const recentItems: string[] = [];
  let lastDaypart: Daypart | null = null;

  for (let i = 0; i < CAMPAIGN_LEN; i++) {
    const date = addDays(startDate, i);
    const dowFullName = dowFull(date) as DayOfWeek;
    const seed = `${campaignId}:${i}`;

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

    let itemIdx = 0;
    for (let k = 0; k < rankedItems.length; k++) {
      const cand = rankedItems[(k + i) % rankedItems.length];
      if (!recentItems.includes(cand.name)) {
        itemIdx = (k + i) % rankedItems.length;
        break;
      }
    }
    const item = rankedItems[itemIdx];
    recentItems.push(item.name);
    if (recentItems.length > 3) recentItems.shift();

    const slownessPush = clamp(chosen.slowness, 0, 2) * 4;
    const isWeekend = dowFullName === "Friday" || dowFullName === "Saturday";
    const weekendTrim = isWeekend ? -3 : 0;
    const jitter = (seededUnit(seed + ":pct") - 0.5) * 6;
    let pct = bandLo + (bandHi - bandLo) * 0.4 + slownessPush + weekendTrim + jitter;
    pct = clamp(Math.round(pct / 5) * 5, 10, 45);

    const { projected_redemptions, projected_revenue } = projectDay(
      sales,
      marketplace,
      dowFullName,
      chosen.daypart,
      pct
    );

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
  opts: { campaignId: string; restaurantId: string; startDate: string; trace?: AgentEvent[] }
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

  return {
    id: opts.campaignId,
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
  const startDate = opts.startDate ?? firstOfNextMonth();
  const restaurantId = opts.restaurantId ?? randomUUID();
  const campaignId = randomUUID();
  const restaurantName = brand.name || sales.restaurant_name;

  const analysis = analyzeSales(sales);
  const { rawDays, meta } = buildDayPlan(sales, brand, marketplace, analysis, {
    startDate,
    campaignId,
  });
  const copyResults = await writeCopy(rawDays, brand, restaurantName, campaignId);
  const days: CampaignDay[] = rawDays.map((d, idx) => ({
    ...d,
    copy: copyResults[idx].copy,
    creative_url: `/api/creative/${d.id}.png`,
  }));
  const campaign = assembleCampaign(sales, brand, marketplace, days, meta, {
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
  if (mkt.in_marketplace) {
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
