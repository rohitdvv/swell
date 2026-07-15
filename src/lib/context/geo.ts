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

  // Geocoder matches best on the first token (city/place name).
  const name = q.split(",")[0].trim() || q;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name
  )}&count=1&language=en&format=json`;

  // Two attempts: one timeout under load must not lose the whole live
  // context. And CRITICALLY, transient failures are never cached — only a
  // definitive "the API answered and found nothing" is. A cached null from
  // one hiccup used to poison every later generation in the process.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`geocode ${res.status}`);
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
        cache.set(q, null); // definitive miss — safe to remember
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
      /* transient — retry once, and never cache the failure */
    }
  }
  return null;
}
