import type { MarketplaceSignals } from "./types";
import { seededUnit, clamp } from "./utils";

const AGE_BANDS = ["21–29", "25–34", "28–38", "30–42", "35–48"];

/**
 * Neutral signals — used when a restaurant isn't yet in the Swell
 * marketplace. Deliberately conservative so the generator leans on
 * sales history (~70/30) without breaking.
 */
export function neutralSignals(avgBasket: number): MarketplaceSignals {
  return {
    in_marketplace: false,
    saves: 0,
    favorites: 0,
    past_redemptions: 0,
    organic_demand_index: 0.5,
    neighborhood: {
      radius_miles: 1,
      dominant_age_band: "28–38",
      median_basket: Math.round(avgBasket || 42),
      consumer_density: "moderate",
    },
    lift_factor: 1.05,
    notes: ["Not yet in the Swell marketplace — using neutral consumer signals."],
  };
}

/**
 * Rich, deterministic signals for a restaurant that IS in the
 * marketplace. Seeded by slug so results are stable and varied.
 * (Read-only mirror of consumer-app data in production.)
 */
export function synthesizeMarketplaceSignals(
  slug: string,
  avgBasket: number
): MarketplaceSignals {
  const u = (salt: string) => seededUnit(slug + ":" + salt);
  const saves = Math.round(120 + u("saves") * 880);
  const favorites = Math.round(saves * (0.35 + u("fav") * 0.3));
  const past_redemptions = Math.round(40 + u("redeem") * 460);
  const organic_demand_index = clamp(0.28 + u("demand") * 0.64, 0, 1);
  const densityRoll = u("density");
  const consumer_density =
    densityRoll > 0.66 ? "high" : densityRoll > 0.33 ? "moderate" : "low";
  // more organic demand + higher density → bigger crowd to convert
  const lift_factor =
    1.12 +
    organic_demand_index * 0.55 +
    (consumer_density === "high" ? 0.25 : consumer_density === "low" ? 0 : 0.12);

  const notes: string[] = [];
  if (organic_demand_index > 0.6)
    notes.push(
      `Strong organic pull (demand index ${organic_demand_index.toFixed(2)}) — favor trial over deep discounts.`
    );
  else if (organic_demand_index < 0.42)
    notes.push(
      `Soft organic demand (index ${organic_demand_index.toFixed(2)}) — hero items + urgency to drive redemptions.`
    );
  else notes.push(`Balanced organic demand (index ${organic_demand_index.toFixed(2)}).`);
  notes.push(`${saves} saves · ${favorites} favorites · ${past_redemptions} past redemptions in-app.`);

  return {
    in_marketplace: true,
    saves,
    favorites,
    past_redemptions,
    organic_demand_index: Math.round(organic_demand_index * 100) / 100,
    neighborhood: {
      radius_miles: 1,
      dominant_age_band: AGE_BANDS[Math.floor(u("age") * AGE_BANDS.length)],
      median_basket: Math.round((avgBasket || 42) * (0.85 + u("basket") * 0.4)),
      consumer_density,
    },
    lift_factor: Math.round(lift_factor * 100) / 100,
    notes,
  };
}
