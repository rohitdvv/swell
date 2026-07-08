import "server-only";
import type { LocalEvent } from "../types";

export type { LocalEvent };

const holidayCache = new Map<string, Record<string, LocalEvent>>();

/**
 * Public holidays for a country/year via the free Nager.Date API (no key).
 * Holidays are strong demand signals (people dine out / stay in).
 */
async function getHolidays(countryCode: string, year: number): Promise<Record<string, LocalEvent>> {
  const key = `${countryCode}:${year}`;
  if (holidayCache.has(key)) return holidayCache.get(key)!;
  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) throw new Error("bad");
    const list = (await res.json()) as Array<{ date: string; name: string; localName: string }>;
    const out: Record<string, LocalEvent> = {};
    for (const h of list) {
      out[h.date] = { name: h.name, type: "holiday", demand: "up" };
    }
    holidayCache.set(key, out);
    return out;
  } catch {
    holidayCache.set(key, {});
    return {};
  }
}

/**
 * Optional: real ticketed events (concerts/sports) near the venue via the
 * Ticketmaster Discovery API — only if TICKETMASTER_API_KEY is set. Returns
 * a map date → the biggest event that day. Degrades silently without a key.
 */
async function getTicketedEvents(
  lat: number,
  lon: number,
  start: string,
  end: string
): Promise<Record<string, LocalEvent>> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return {};
  try {
    const url =
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}` +
      `&latlong=${lat},${lon}&radius=10&unit=miles&size=100&sort=date,asc` +
      `&startDateTime=${start}T00:00:00Z&endDateTime=${end}T23:59:59Z`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) throw new Error("bad");
    const j = (await res.json()) as {
      _embedded?: { events?: Array<{ name: string; dates?: { start?: { localDate?: string } }; classifications?: Array<{ segment?: { name?: string } }> }> };
    };
    const out: Record<string, LocalEvent> = {};
    for (const e of j._embedded?.events ?? []) {
      const date = e.dates?.start?.localDate;
      if (!date) continue;
      const seg = e.classifications?.[0]?.segment?.name?.toLowerCase() || "";
      const type: LocalEvent["type"] = seg.includes("sport")
        ? "sports"
        : seg.includes("music")
          ? "concert"
          : "event";
      // keep the first (earliest / already sorted) per date
      if (!out[date]) out[date] = { name: e.name, type, demand: "up" };
    }
    return out;
  } catch {
    return {};
  }
}

export async function getEvents(
  countryCode: string,
  lat: number,
  lon: number,
  dates: string[]
): Promise<Record<string, LocalEvent>> {
  if (dates.length === 0) return {};
  const years = [...new Set(dates.map((d) => Number(d.slice(0, 4))))];
  const start = dates[0];
  const end = dates[dates.length - 1];

  const holidayMaps = await Promise.all(years.map((y) => getHolidays(countryCode, y)));
  const ticketed = await getTicketedEvents(lat, lon, start, end);

  const merged: Record<string, LocalEvent> = {};
  for (const m of holidayMaps) Object.assign(merged, m);
  // ticketed events take priority (more specific demand signal)
  Object.assign(merged, ticketed);

  // only keep events within our campaign window
  const inWindow: Record<string, LocalEvent> = {};
  for (const d of dates) if (merged[d]) inWindow[d] = merged[d];
  return inWindow;
}
