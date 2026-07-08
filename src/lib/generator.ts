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

const CAMPAIGN_LEN = 30;

type ItemScore = {
  name: string;
  qty: number;
  net: number;
  price: number;
  pmix: number; // 0..1 share of quantity
  hero: number; // 0..1 signature/premium score
  trial: number; // 0..1 broad-appeal score
};

function firstOfNextMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return toISODate(d);
}

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
      // hero = premium + still meaningful volume (high margin per plate)
      hero: clamp(0.65 * priceNorm + 0.35 * qtyNorm, 0, 1),
      // trial = broad appeal (high PMIX, mid price)
      trial: clamp(0.7 * qtyNorm + 0.3 * (1 - Math.abs(priceNorm - 0.5) * 2), 0, 1),
    };
  });
}

type DaypartAnalysis = {
  daypart: Daypart;
  net: number;
  orders: number;
  z: number;
  slowness: number; // higher = slower vs peers
  operating: boolean;
  weight: number; // scheduling weight
};

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
      // slower dayparts get more promo slots (softmax-ish, floor so peaks still appear)
      weight: isOp ? Math.exp(slowness * 0.9) : 0,
    };
  });
}

function discountBand(organic: number): [number, number] {
  if (organic > 0.6) return [15, 25]; // high pull → drive trial, protect margin
  if (organic < 0.42) return [25, 40]; // soft pull → urgency
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

export async function generateCampaign(
  sales: ParsedSalesSummary,
  brand: BrandKit,
  marketplace: MarketplaceSignals,
  opts: { startDate?: string; restaurantId?: string } = {}
): Promise<{ campaign: Campaign; days: CampaignDay[] }> {
  const restaurantName = brand.name || sales.restaurant_name;
  const restaurantSlug = slugify(restaurantName);
  const startDate = opts.startDate ?? firstOfNextMonth();
  const restaurantId = opts.restaurantId ?? randomUUID();
  const campaignId = randomUUID();

  const totalOrders = sales.order_count || 1;
  const dataDays = Math.max(sales.date_range.days, 14);

  const daypartAnalysis = analyzeDayparts(sales, totalOrders);
  const operating = daypartAnalysis.filter((d) => d.operating);
  const items = scoreItems(sales);
  const [bandLo, bandHi] = discountBand(marketplace.organic_demand_index);
  const heroMode = marketplace.organic_demand_index < 0.42;

  // Ranked item candidates: heroes-first if urgency mode, else broad-appeal first.
  const rankedItems = [...items].sort((a, b) =>
    heroMode ? b.hero - a.hero : b.trial - a.trial
  );

  // ---- assemble 30 days ----
  const rawDays: Array<Omit<CampaignDay, "copy" | "creative_url">> = [];
  const recentItems: string[] = [];
  let lastDaypart: Daypart | null = null;

  for (let i = 0; i < CAMPAIGN_LEN; i++) {
    const date = addDays(startDate, i);
    const dowFullName = dowFull(date) as DayOfWeek;
    const seed = `${campaignId}:${i}`;

    // choose daypart (weighted by slowness), avoid same as previous day when possible
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

    // choose item — rotate, avoid last 3
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

    // discount %: band + slowness push + weekend protection, snapped to 5
    const slownessPush = clamp(chosen.slowness, 0, 2) * 4; // slower → deeper
    const isWeekend = dowFullName === "Friday" || dowFullName === "Saturday";
    const weekendTrim = isWeekend ? -3 : 0; // protect margin on busy nights
    const jitter = (seededUnit(seed + ":pct") - 0.5) * 6;
    let pct = bandLo + (bandHi - bandLo) * 0.4 + slownessPush + weekendTrim + jitter;
    pct = clamp(Math.round(pct / 5) * 5, 10, 45);

    // projections (shared with inline-edit endpoint)
    const { projected_redemptions, projected_revenue } = projectDay(
      sales,
      marketplace,
      dowFullName,
      chosen.daypart,
      pct
    );

    const rationale = buildRationale(chosen, item, pct, marketplace, heroMode);

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
      rationale,
      edited: false,
    });
  }

  // ---- copy generation (LLM or deterministic) ----
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
  const copyResults = await generateCopyBatch(copyInputs);

  const days: CampaignDay[] = rawDays.map((d, idx) => ({
    ...d,
    copy: copyResults[idx].copy,
    creative_url: `/api/creative/${d.id}.png`,
  }));

  const projected_revenue = days.reduce((a, b) => a + b.projected_revenue, 0);
  const projected_redemptions = days.reduce((a, b) => a + b.projected_redemptions, 0);
  const baseline_revenue = Math.round(
    (sales.total_net_sales / dataDays) * CAMPAIGN_LEN
  );

  const slowNames = operating
    .filter((d) => d.slowness > 0.2)
    .sort((a, b) => b.slowness - a.slowness)
    .map((d) => d.daypart);
  const heroNames = rankedItems.slice(0, 3).map((i) => i.name);

  const strategy_notes = buildStrategyNotes(
    slowNames,
    heroNames,
    marketplace,
    [bandLo, bandHi],
    heroMode
  );

  const campaign: Campaign = {
    id: campaignId,
    restaurant_id: restaurantId,
    slug: `${restaurantSlug}-${monthSlug(startDate)}`,
    restaurant_slug: restaurantSlug,
    restaurant_name: restaurantName,
    month: monthLabel(startDate),
    start_date: startDate,
    title: `${restaurantName} — ${monthLabel(startDate).split(" ")[0]} Momentum Plan`,
    status: "draft",
    paused: true,
    projected_revenue,
    projected_redemptions,
    baseline_revenue,
    brand,
    marketplace,
    sales_summary: sales,
    strategy_notes,
    created_at: new Date().toISOString(),
    published_at: null,
  };

  return { campaign, days };
}

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
      `Not yet in the Got60 marketplace — leaning on sales history with conservative lift until live demand data flows in.`
    );
  }
  return notes;
}
