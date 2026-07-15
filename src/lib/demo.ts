import "server-only";
import { repo } from "./db";
import { orchestrate } from "./orchestrator";
import { buildSampleCsv, SAMPLE_LOCATION } from "./sample";
import { summarize, fileToRows } from "./csv";
import type { CampaignWithDays } from "./types";

export const DEMO_SLUG = "demo";

/** Regenerate when older than this so the weather forecast stays live. */
const MAX_AGE_HOURS = 12;

// Guard against two visitors triggering generation at the same time.
let inFlight: Promise<CampaignWithDays> | null = null;

function isStale(createdAt: string): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs > MAX_AGE_HOURS * 60 * 60 * 1000;
}

/**
 * A demo generated during a transient API failure is a visibly broken
 * showcase: no location, no weather, or (with a key configured) no events.
 * Treat it as degraded and regenerate after 5 min instead of caching 12h.
 */
function isDegraded(c: CampaignWithDays): boolean {
  const noLocation = !c.context?.located; // demo always passes a location
  const noEvents =
    !!process.env.TICKETMASTER_API_KEY && (c.context?.event_days ?? 0) === 0;
  if (!noLocation && !noEvents) return false;
  const ageMs = Date.now() - new Date(c.created_at).getTime();
  return ageMs > 5 * 60 * 1000;
}

async function generateDemo(): Promise<CampaignWithDays> {
  const { csv, meta } = buildSampleCsv(45);
  const sales = summarize(fileToRows(Buffer.from(csv), "sample.csv"), meta.restaurant_name);

  const { campaign, days } = await orchestrate({
    sales,
    name: meta.restaurant_name,
    location: SAMPLE_LOCATION,
    marketplace: "demo",
  });

  // Stable public URL, and it reads as published + live for demo purposes.
  campaign.slug = DEMO_SLUG;
  campaign.status = "published";
  campaign.paused = false;
  campaign.published_at = new Date().toISOString();

  await repo.upsertRestaurant({
    id: campaign.restaurant_id,
    slug: campaign.restaurant_slug,
    name: campaign.restaurant_name,
    website_url: null,
    brand: campaign.brand,
    marketplace: campaign.marketplace,
    sales,
  });
  await repo.createCampaign(campaign, days); // replaces any prior row with this slug

  const saved = await repo.getCampaignBySlug(DEMO_SLUG);
  return saved ?? { ...campaign, days };
}

/**
 * The public demo campaign. Cached in Postgres and refreshed every 12h so the
 * weather it shows is a genuinely live forecast, not a stale snapshot.
 */
export async function getDemoCampaign(): Promise<CampaignWithDays> {
  const existing = await repo.getCampaignBySlug(DEMO_SLUG);
  if (existing && !isStale(existing.created_at) && !isDegraded(existing)) return existing;

  if (!inFlight) {
    inFlight = generateDemo().finally(() => {
      inFlight = null;
    });
  }
  try {
    return await inFlight;
  } catch (err) {
    console.error("demo generation failed", err);
    if (existing) return existing; // serve stale rather than nothing
    throw err;
  }
}
