import "server-only";

export type GeoLocation = {
  query: string;
  name: string;
  admin1: string | null;
  country: string;
  country_code: string;
  lat: number;
  lon: number;
  timezone: string;
};

const cache = new Map<string, GeoLocation | null>();

/**
 * Geocode a hotel/restaurant location (city, neighborhood, or address)
 * to coordinates + country using the free Open-Meteo geocoding API.
 * No key required. Resilient: returns null on any failure.
 */
export async function geocode(query: string): Promise<GeoLocation | null> {
  const q = query.trim();
  if (!q) return null;
  if (cache.has(q)) return cache.get(q)!;
  try {
    // Geocoder matches best on the first token (city/place name).
    const name = q.split(",")[0].trim() || q;
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=1&language=en&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error("bad");
    const data = (await res.json()) as {
      results?: Array<{
        name: string;
        admin1?: string;
        country?: string;
        country_code?: string;
        latitude: number;
        longitude: number;
        timezone?: string;
      }>;
    };
    const r = data.results?.[0];
    if (!r) {
      cache.set(q, null);
      return null;
    }
    const loc: GeoLocation = {
      query: q,
      name: r.name,
      admin1: r.admin1 ?? null,
      country: r.country ?? "",
      country_code: (r.country_code ?? "US").toUpperCase(),
      lat: r.latitude,
      lon: r.longitude,
      timezone: r.timezone ?? "auto",
    };
    cache.set(q, loc);
    return loc;
  } catch {
    cache.set(q, null);
    return null;
  }
}
