import "server-only";
import { geocode, type GeoLocation } from "./geo";
import { getForecast, getClimateNormals } from "./weather";
import { getEvents } from "./events";
import type { DayWeather, LocalEvent, ContextSummary } from "../types";

export type { GeoLocation, DayWeather, LocalEvent, ContextSummary };

export type DayContext = {
  weather: DayWeather | null;
  event: LocalEvent | null;
};

export type CampaignContext = {
  location: GeoLocation | null;
  byDate: Record<string, DayContext>;
  summary: ContextSummary;
};

export const EMPTY_CONTEXT: CampaignContext = {
  location: null,
  byDate: {},
  summary: {
    located: false,
    location_label: null,
    forecast_days: 0,
    seasonal_days: 0,
    rain_days: 0,
    warm_days: 0,
    cold_days: 0,
    event_days: 0,
    avg_temp_f: null,
  },
};

/**
 * Weather for every campaign day. The forecast only reaches ~16 days, so the
 * tail of a 30-day campaign is filled with climate normals for the same
 * calendar dates — marked `source: "seasonal"` so nothing is passed off as a
 * forecast.
 */
export async function getWeatherForDates(
  lat: number,
  lon: number,
  dates: string[]
): Promise<Record<string, DayWeather>> {
  const forecast = await getForecast(lat, lon);
  const uncovered = dates.filter((d) => !forecast[d]);
  if (uncovered.length === 0) return forecast;
  const normals = await getClimateNormals(lat, lon, uncovered);
  return { ...normals, ...forecast }; // a real forecast always wins
}

/**
 * Gather live real-world context (location → weather + local events) for a set
 * of campaign dates. Fully resilient — any failure degrades to empty context
 * so the generator always runs.
 */
export async function gatherContext(input: {
  location?: string;
  dates: string[];
}): Promise<CampaignContext> {
  const loc = input.location?.trim();
  if (!loc) return EMPTY_CONTEXT;

  const location = await geocode(loc);
  if (!location) return { ...EMPTY_CONTEXT };

  const [weather, events] = await Promise.all([
    getWeatherForDates(location.lat, location.lon, input.dates),
    getEvents(location.country_code, location.lat, location.lon, input.dates),
  ]);

  return buildCampaignContext(location, weather, events, input.dates);
}

/** Assemble a CampaignContext from already-fetched parts (used by the orchestrator). */
export function buildCampaignContext(
  location: GeoLocation | null,
  weather: Record<string, DayWeather>,
  events: Record<string, LocalEvent>,
  dates: string[]
): CampaignContext {
  if (!location) return { ...EMPTY_CONTEXT };
  const byDate: Record<string, DayContext> = {};
  let rain = 0,
    warm = 0,
    cold = 0,
    eventDays = 0,
    tempSum = 0,
    tempCount = 0,
    forecastDays = 0,
    seasonalDays = 0;

  for (const date of dates) {
    const w = weather[date] ?? null;
    const e = events[date] ?? null;
    byDate[date] = { weather: w, event: e };
    if (w) {
      tempSum += w.tempF;
      tempCount++;
      if (w.source === "seasonal") seasonalDays++;
      else forecastDays++;
      if (w.wet) rain++;
      if (w.bucket === "warm" || w.bucket === "hot") warm++;
      if (w.bucket === "cold" || w.bucket === "cool") cold++;
    }
    if (e) eventDays++;
  }

  return {
    location,
    byDate,
    summary: {
      located: true,
      location_label: [location.name, location.admin1].filter(Boolean).join(", "),
      forecast_days: forecastDays,
      seasonal_days: seasonalDays,
      rain_days: rain,
      warm_days: warm,
      cold_days: cold,
      event_days: eventDays,
      avg_temp_f: tempCount ? Math.round(tempSum / tempCount) : null,
    },
  };
}
