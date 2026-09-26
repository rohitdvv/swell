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

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

type Hit = {
  name: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  country?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  population?: number;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Hints from the rest of the address: "Austin", "TX" → ["austin", "texas", "tx"]. */
function hintsFrom(tokens: string[]): string[] {
  return tokens.flatMap((t) => {
    const up = t.trim().toUpperCase();
    return US_STATES[up] ? [norm(US_STATES[up]), norm(up)] : [norm(t)];
  }).filter(Boolean);
}

function matches(hit: Hit, hints: string[]): number {
  const fields = [hit.name, hit.admin1, hit.admin2, hit.admin3, hit.country, hit.country_code].filter(Boolean).map((f) => norm(f!));
  return hints.filter((h) => fields.some((f) => f === h)).length;
}

async function search(name: string): Promise<Hit[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json`;
  // Two attempts; a transient failure throws (and is never cached by the caller).
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`geocode ${res.status}`);
      const data = (await res.json()) as { results?: Hit[] };
      return data.results ?? [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * Geocode a restaurant location (address, neighborhood + city, or city) with
 * the free Open-Meteo geocoder. The geocoder only matches place NAMES, so we
 * search one part at a time and let the rest of the address decide:
 *   "Hyde Park, Austin, TX" → "Hyde Park" has no match in Texas (there's one
 *   in Vermont) → try "Austin" with hint "TX" → Austin, Texas.
 * Resilient: returns null on failure; transient failures are never cached.
 */
export async function geocode(query: string): Promise<GeoLocation | null> {
  const q = query.trim();
  if (!q) return null;
  if (cache.has(q)) return cache.get(q)!;

  const tokens = q.split(",").map((t) => t.trim()).filter(Boolean);
  // Street numbers can't be geocoded by name — drop "123 Main St" style parts.
  const places = tokens.filter((t) => !/^\d+\s/.test(t) && !US_STATES[t.toUpperCase()]);
  let chosen: Hit | null = null;
  try {
    for (let i = 0; i < places.length && !chosen; i++) {
      const hints = hintsFrom(tokens.filter((t) => t !== places[i]));
      const hits = await search(places[i]);
      if (!hits.length) continue;
      if (!hints.length) {
        chosen = hits[0];
        break;
      }
      const ranked = hits
        .map((h) => ({ h, score: matches(h, hints) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || (b.h.population ?? 0) - (a.h.population ?? 0));
      if (ranked.length) chosen = ranked[0].h;
    }
  } catch {
    return null; // transient — don't cache
  }

  if (!chosen) {
    cache.set(q, null); // the API answered; nothing matched
    return null;
  }
  const loc: GeoLocation = {
    query: q,
    name: chosen.name,
    admin1: chosen.admin1 ?? null,
    country: chosen.country ?? "",
    country_code: (chosen.country_code ?? "US").toUpperCase(),
    lat: chosen.latitude,
    lon: chosen.longitude,
    timezone: chosen.timezone ?? "auto",
  };
  cache.set(q, loc);
  return loc;
}
