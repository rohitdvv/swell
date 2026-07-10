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
type TmEvent = {
  name: string;
  dates?: { start?: { localDate?: string } };
  classifications?: Array<{ segment?: { name?: string } }>;
  _embedded?: {
    venues?: Array<{ name?: string }>;
    attractions?: Array<{ name?: string }>;
  };
};

/** Bigger crowds move more covers. Rank so the best event wins the day. */
function eventScore(e: TmEvent, type: LocalEvent["type"]): number {
  let score = type === "sports" ? 3 : type === "concert" ? 2 : 1;
  // A named performer/team means a real draw, not a standing exhibition.
  if (e._embedded?.attractions?.length) score += 2;
  // Recurring tours/exhibitions are weak demand signals.
  if (/\b(tour|museum|exhibit|experience)\b/i.test(e.name)) score -= 2;
  return score;
}

const MAX_PAGES = 5; // Ticketmaster caps size*page at 1000

async function getTicketedEvents(
  lat: number,
  lon: number,
  start: string,
  end: string
): Promise<Record<string, LocalEvent>> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return {};

  const fetchPage = async (page: number) => {
    const url =
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}` +
      `&latlong=${lat},${lon}&radius=10&unit=miles&size=200&page=${page}&sort=date,asc` +
      // Only demand-moving categories — otherwise recurring exhibitions
      // fill the whole page and crowd out real games and concerts.
      `&classificationName=music,sports` +
      `&startDateTime=${start}T00:00:00Z&endDateTime=${end}T23:59:59Z`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`ticketmaster ${res.status}`);
    return (await res.json()) as {
      _embedded?: { events?: TmEvent[] };
      page?: { totalPages?: number };
    };
  };

  try {
    // One page is not enough: a busy city returns hundreds of events and the
    // first page alone covered barely half the month.
    const first = await fetchPage(0);
    const events: TmEvent[] = [...(first._embedded?.events ?? [])];
    const totalPages = Math.min(first.page?.totalPages ?? 1, MAX_PAGES);
    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 1).catch(() => null))
      );
      for (const r of rest) if (r?._embedded?.events) events.push(...r._embedded.events);
    }

    const best: Record<string, { event: LocalEvent; score: number }> = {};
    for (const e of events) {
      const date = e.dates?.start?.localDate;
      if (!date) continue;
      // The API occasionally returns dates outside the window — re-check.
      if (date < start || date > end) continue;

      const seg = e.classifications?.[0]?.segment?.name?.toLowerCase() || "";
      const type: LocalEvent["type"] = seg.includes("sport")
        ? "sports"
        : seg.includes("music")
          ? "concert"
          : "event";
      const score = eventScore(e, type);
      if (best[date] && best[date].score >= score) continue;
      best[date] = {
        score,
        event: {
          name: e.name,
          type,
          demand: "up",
          venue: e._embedded?.venues?.[0]?.name ?? null,
        },
      };
    }

    const out: Record<string, LocalEvent> = {};
    for (const [date, v] of Object.entries(best)) out[date] = v.event;
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
