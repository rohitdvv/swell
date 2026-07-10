import "server-only";
import type { DayWeather } from "../types";

export type { DayWeather };

// WMO weather code → human condition + emoji
function decodeWmo(code: number): { condition: string; icon: string; wet: boolean } {
  if (code === 0) return { condition: "Clear", icon: "☀️", wet: false };
  if (code <= 3) return { condition: "Partly cloudy", icon: "⛅", wet: false };
  if (code <= 48) return { condition: "Fog", icon: "🌫️", wet: false };
  if (code <= 57) return { condition: "Drizzle", icon: "🌦️", wet: true };
  if (code <= 67) return { condition: "Rain", icon: "🌧️", wet: true };
  if (code <= 77) return { condition: "Snow", icon: "🌨️", wet: true };
  if (code <= 82) return { condition: "Showers", icon: "🌦️", wet: true };
  if (code <= 86) return { condition: "Snow showers", icon: "🌨️", wet: true };
  return { condition: "Thunderstorm", icon: "⛈️", wet: true };
}

function tempBucket(f: number): DayWeather["bucket"] {
  if (f < 40) return "cold";
  if (f < 58) return "cool";
  if (f < 74) return "mild";
  if (f < 85) return "warm";
  return "hot";
}

/**
 * Fetch the real daily forecast (up to 16 days) from the free Open-Meteo API.
 * No key. Returns a map keyed by YYYY-MM-DD; dates beyond the horizon are absent.
 */
export async function getForecast(
  lat: number,
  lon: number
): Promise<Record<string, DayWeather>> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&temperature_unit=fahrenheit&forecast_days=16&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) throw new Error("bad");
    const j = (await res.json()) as {
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: (number | null)[];
      };
    };
    const d = j.daily;
    if (!d) return {};
    const out: Record<string, DayWeather> = {};
    for (let i = 0; i < d.time.length; i++) {
      const code = d.weather_code[i];
      const { condition, icon, wet } = decodeWmo(code);
      const tempF = Math.round(d.temperature_2m_max[i]);
      out[d.time[i]] = {
        tempF,
        lowF: Math.round(d.temperature_2m_min[i]),
        code,
        condition,
        icon,
        rainProb: Math.round(d.precipitation_probability_max[i] ?? 0),
        bucket: tempBucket(tempF),
        wet: wet || (d.precipitation_probability_max[i] ?? 0) >= 55,
        source: "forecast",
      };
    }
    return out;
  } catch {
    return {};
  }
}

// ---- Climate normals (days 17-30) --------------------------

const NORMAL_YEARS = 5;

function shiftYears(iso: string, back: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y - back}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function mmdd(iso: string): string {
  return iso.slice(5);
}

type ArchiveDaily = {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
};

/**
 * A weather forecast only reaches ~16 days, but a campaign runs 30. For the
 * remaining dates we compute a **climate normal**: the average of that exact
 * calendar date over the last few years, from Open-Meteo's free archive.
 *
 * These are explicitly marked `source: "seasonal"` so the UI can label them
 * as typical-for-the-date rather than pretending to know the weather.
 */
export async function getClimateNormals(
  lat: number,
  lon: number,
  dates: string[]
): Promise<Record<string, DayWeather>> {
  if (dates.length === 0) return {};
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const fetchYear = async (back: number): Promise<ArchiveDaily | null> => {
    try {
      const url =
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
        `&start_date=${shiftYears(first, back)}&end_date=${shiftYears(last, back)}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&temperature_unit=fahrenheit&timezone=auto`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const j = (await res.json()) as { daily?: ArchiveDaily };
      return j.daily ?? null;
    } catch {
      return null;
    }
  };

  const years = await Promise.all(
    Array.from({ length: NORMAL_YEARS }, (_, i) => fetchYear(i + 1))
  );

  // Bucket every observed year by calendar date (MM-DD).
  const acc: Record<string, { max: number[]; min: number[]; precip: number[] }> = {};
  for (const daily of years) {
    if (!daily) continue;
    for (let i = 0; i < daily.time.length; i++) {
      const key = mmdd(daily.time[i]);
      const max = daily.temperature_2m_max[i];
      const min = daily.temperature_2m_min[i];
      const p = daily.precipitation_sum[i];
      if (max == null || min == null) continue;
      acc[key] ??= { max: [], min: [], precip: [] };
      acc[key].max.push(max);
      acc[key].min.push(min);
      acc[key].precip.push(p ?? 0);
    }
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const out: Record<string, DayWeather> = {};
  for (const date of sorted) {
    const a = acc[mmdd(date)];
    if (!a || a.max.length === 0) continue; // no history → leave the day blank
    const tempF = Math.round(mean(a.max));
    // Share of past years where this date was actually wet → a real probability.
    const wetYears = a.precip.filter((p) => p >= 1).length;
    const rainProb = Math.round((wetYears / a.precip.length) * 100);
    const wet = rainProb >= 50;
    const bucket = tempBucket(tempF);
    out[date] = {
      tempF,
      lowF: Math.round(mean(a.min)),
      code: -1,
      condition: wet ? "Typically wet" : "Seasonal average",
      icon: wet ? "🌧️" : bucket === "hot" || bucket === "warm" ? "☀️" : "⛅",
      rainProb,
      bucket,
      wet,
      source: "seasonal",
    };
  }
  return out;
}
