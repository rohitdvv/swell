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
      };
    }
    return out;
  } catch {
    return {};
  }
}
