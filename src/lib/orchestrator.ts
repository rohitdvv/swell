import "server-only";
import { randomUUID } from "node:crypto";
import type {
  ParsedSalesSummary,
  BrandKit,
  MarketplaceSignals,
  Campaign,
  CampaignDay,
  AgentEvent,
} from "./types";
import {
  analyzeSales,
  buildDayPlan,
  writeCopy,
  assembleCampaign,
  defaultStartDate,
} from "./generator";
import { extractBrandKit, neutralBrandKit } from "./brand";
import { synthesizeMarketplaceSignals, neutralSignals } from "./marketplace";
import { repo } from "./db";
import { slugify, addDays } from "./utils";
import { geocode } from "./context/geo";
import { getEvents } from "./context/events";
import {
  buildCampaignContext,
  getWeatherForDates,
  EMPTY_CONTEXT,
  type CampaignContext,
} from "./context";
import { CAMPAIGN_LEN } from "./generator";
import { trainSalesModel } from "./model";

export type OrchestrationInput = {
  sales: ParsedSalesSummary;
  brand?: BrandKit;
  url?: string;
  name?: string;
  location?: string;
  marketplace?: "demo" | "neutral" | "auto";
  startDate?: string;
  restaurantId?: string;
  /** Live progress hook — lets the API stream each agent's thinking to the UI. */
  onEvent?: (e: AgentProgressEvent) => void;
};

export type AgentProgressEvent =
  | { type: "agent:start"; agent: AgentEvent["agent"]; role: string }
  | { type: "agent:done"; agent: AgentEvent["agent"]; detail: string; ms: number };

/**
 * The Swell brain runs as a team of specialised agents coordinated on a
 * shared context (blackboard). Each agent owns one responsibility and hands
 * its output to the next. Every run produces an inspectable activity trace.
 *
 *   Brand ─┐
 *   Demand ─┼─▶ Analyst ─▶ Strategy ─▶ Copywriter ─▶ Creative ─▶ Revenue
 */
export async function orchestrate(
  input: OrchestrationInput
): Promise<{ campaign: Campaign; days: CampaignDay[]; trace: AgentEvent[] }> {
  const trace: AgentEvent[] = [];
  // Progress events must never break a run — swallow listener errors.
  const emit = (e: AgentProgressEvent) => {
    try {
      input.onEvent?.(e);
    } catch {
      /* listener errors are not our problem */
    }
  };
  const track = async <T>(
    agent: AgentEvent["agent"],
    role: string,
    fn: () => Promise<T> | T,
    detail: (r: T) => string
  ): Promise<T> => {
    emit({ type: "agent:start", agent, role });
    const t0 = performance.now();
    const result = await fn();
    const ms = Math.round(performance.now() - t0);
    const d = detail(result);
    trace.push({ agent, role, detail: d, ms });
    emit({ type: "agent:done", agent, detail: d, ms });
    return result;
  };

  const { sales } = input;
  const startDate = input.startDate ?? defaultStartDate();
  const restaurantId = input.restaurantId ?? randomUUID();
  const campaignId = randomUUID();

  // 1 — BRAND AGENT: read the restaurant's website into a brand kit
  const brand = await track(
    "Brand Agent",
    "Reads the website → logo, palette, type, voice, imagery",
    async () => {
      if (input.brand) return input.brand;
      const url = (input.url || "").trim();
      return url ? await extractBrandKit(url) : neutralBrandKit(input.name || sales.restaurant_name);
    },
    (b) =>
      `Palette ${b.primary_color} · voice “${b.voice_summary}” · ${
        b.image_urls?.length ?? 0
      } site image${(b.image_urls?.length ?? 0) === 1 ? "" : "s"} · ${
        b.logo_url ? "logo found" : "no logo"
      }`
  );
  if (!brand.name) brand.name = input.name || sales.restaurant_name;
  const restaurantName = brand.name;
  const slug = slugify(restaurantName);
  const avgBasket =
    sales.order_count > 0 ? Math.round(sales.total_net_sales / sales.order_count) : 42;

  // 2 — DEMAND AGENT: read the live consumer marketplace
  const marketplace = await track(
    "Demand Agent",
    "Reads live marketplace demand (saves, redemptions, neighborhood)",
    async () => {
      const mode = input.marketplace || "auto";
      if (mode === "neutral") return neutralSignals(avgBasket);
      if (mode === "demo") {
        const s = synthesizeMarketplaceSignals(slug, avgBasket);
        await repo.putMarketplaceSignal(slug, s);
        return s;
      }
      return (await repo.getMarketplaceSignal(slug)) ?? neutralSignals(avgBasket);
    },
    (m) =>
      m.in_marketplace
        ? `Organic demand ${(m.organic_demand_index * 100) | 0}/100 · ${m.saves} saves · lift ×${m.lift_factor.toFixed(2)}`
        : `Not in marketplace — neutral signals (lift ×${m.lift_factor.toFixed(2)})`
  );

  // Campaign date window (for weather + events lookups)
  const dates = Array.from({ length: CAMPAIGN_LEN }, (_, i) => addDays(startDate, i));

  // 3 — LOCATION AGENT: geocode the venue
  const location = await track(
    "Location Agent",
    "Geocodes the venue to coordinates for live conditions",
    () => (input.location ? geocode(input.location) : Promise.resolve(null)),
    (l) =>
      l
        ? `${[l.name, l.admin1].filter(Boolean).join(", ")} (${l.lat.toFixed(2)}, ${l.lon.toFixed(2)})`
        : input.location
          ? `could not geocode “${input.location}” — continuing without live context`
          : "no location provided — skipping live context"
  );

  // 4 + 5 — WEATHER + EVENTS AGENTS (parallel, real-time)
  let context: CampaignContext = EMPTY_CONTEXT;
  if (location) {
    const [weather, events] = await Promise.all([
      track(
        "Weather Agent",
        "Pulls the live forecast, then climate normals for the days beyond it",
        () => getWeatherForDates(location.lat, location.lon, dates),
        (w) => {
          const all = Object.values(w);
          if (all.length === 0) return "no weather available";
          const live = all.filter((d) => d.source === "forecast").length;
          const seasonal = all.length - live;
          const wet = all.filter((d) => d.wet).length;
          const avg = Math.round(all.reduce((s, d) => s + d.tempF, 0) / all.length);
          const tail = seasonal ? ` + ${seasonal} days seasonal normals` : "";
          return `${live}-day live forecast${tail} · avg ${avg}° · ${wet} wet day${wet === 1 ? "" : "s"}`;
        }
      ),
      track(
        "Events Agent",
        "Finds holidays & nearby events that move demand",
        () => getEvents(location.country_code, location.lat, location.lon, dates),
        (e) => {
          const n = Object.keys(e).length;
          const sample = Object.values(e)[0]?.name;
          return n ? `${n} event day${n === 1 ? "" : "s"} in window${sample ? ` (e.g. ${sample})` : ""}` : "no events in window";
        }
      ),
    ]);
    context = buildCampaignContext(location, weather, events, dates);
  }

  // 6 — ANALYST AGENT: train the forecasting model + z-score dayparts
  const analysis = await track(
    "Analyst Agent",
    "Trains a forecasting model on your history, then z-scores dayparts & scores items",
    () => Promise.resolve({ a: analyzeSales(sales), m: trainSalesModel(sales) }),
    ({ a, m }) => {
      const slow = [...a.operating].sort((x, y) => y.slowness - x.slowness)[0];
      let modelBit = "";
      if (m) {
        const vsNaive = m.cv.skill > 0 ? `${Math.round(m.cv.skill * 100)}% better than naive` : "≈ naive";
        const held = m.interval.coverage80 !== null ? `, 80% range held ${Math.round(m.interval.coverage80 * 100)}%` : "";
        modelBit = `picked ${m.chosen} from 3 models (walk-forward ±$${m.mae}/day, ${vsNaive}${held}) · `;
      }
      return `${modelBit}slowest ${slow?.daypart} (z ${slow?.z}) · ${a.items.length} items scored`;
    }
  ).then((r) => r.a);

  // 7 — STRATEGY AGENT: assemble the 30-day plan (weather/event-aware)
  const { rawDays, meta } = await track(
    "Strategy Agent",
    "Composes 30 offers — item, window & discount, adapted to weather & events",
    () => buildDayPlan(sales, brand, marketplace, analysis, context, { startDate, campaignId }),
    ({ rawDays, meta }) => {
      const avg = Math.round(rawDays.reduce((s, d) => s + d.pct_off, 0) / rawDays.length);
      const adapted = rawDays.filter((d) => d.context_note).length;
      return `30 offers · avg ${avg}% off · ${meta.heroMode ? "urgency mode (hero items)" : "trial mode (broad items)"}${
        adapted ? ` · ${adapted} weather/event-adapted` : ""
      }`;
    }
  );

  // 5 — COPYWRITER AGENT: one on-brand caption per day (+ guardrail)
  const copyResults = await track(
    "Copywriter Agent",
    "Writes an on-brand caption per day, passed through the guardrail",
    () => writeCopy(rawDays, brand, restaurantName, campaignId),
    (rs) => {
      const llm = rs.filter((r) => r.source === "llm").length;
      const regen = rs.filter((r) => r.guardrail !== "passed").length;
      return `30 captions · ${llm ? `${llm} via LLM` : "deterministic engine"} · ${regen} guardrail regenerations`;
    }
  );

  // 6 — CREATIVE AGENT: brand-native poster per day
  const days = await track(
    "Creative Agent",
    "Renders a branded poster per day (colors, logo, food imagery)",
    () =>
      rawDays.map((d, idx) => ({
        ...d,
        copy: copyResults[idx].copy,
        creative_url: `/api/creative/${d.id}.png`,
      })) as CampaignDay[],
    () =>
      `30 posters queued · duotoned to ${brand.primary_color} · ${
        (brand.image_urls?.length ?? 0) > 0 ? "restaurant photography" : "food imagery"
      }`
  );

  // 7 — REVENUE AGENT: projections roll-up + assemble campaign
  const campaign = await track(
    "Revenue Agent",
    "Projects redemptions × lift and rolls up incremental revenue",
    () =>
      assembleCampaign(sales, brand, marketplace, days, meta, context, {
        campaignId,
        restaurantId,
        startDate,
        location: input.location ?? null,
        trace,
      }),
    (c) =>
      `$${c.projected_revenue.toLocaleString()} incremental · ${c.projected_redemptions.toLocaleString()} redemptions · ${(
        (c.projected_revenue / Math.max(1, c.baseline_revenue)) *
        100
      ).toFixed(1)}% lift`
  );

  // trace is captured by reference inside the campaign
  campaign.agent_trace = trace;

  return { campaign, days, trace };
}
