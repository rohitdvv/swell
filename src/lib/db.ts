import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  Campaign,
  CampaignDay,
  CampaignWithDays,
  BrandKit,
  MarketplaceSignals,
  ParsedSalesSummary,
} from "./types";

// ------------------------------------------------------------
// Connection (singleton across HMR reloads)
// ------------------------------------------------------------
function resolveDbPath(): string {
  const explicit = process.env.SWELL_DB;
  if (explicit) return explicit;
  const dir = path.join(process.cwd(), "data");
  try {
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "swell.db");
  } catch {
    // Read-only FS (e.g. serverless) → fall back to tmp.
    return path.join("/tmp", "swell.db");
  }
}

const g = globalThis as unknown as { __swell_db?: Database.Database };

function getDb(): Database.Database {
  if (g.__swell_db) return g.__swell_db;
  const db = new Database(resolveDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  init(db);
  g.__swell_db = db;
  return db;
}

function init(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      website_url TEXT,
      brand_json TEXT,
      marketplace_json TEXT,
      sales_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      restaurant_slug TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      month TEXT NOT NULL,
      start_date TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      paused INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      projected_revenue REAL NOT NULL DEFAULT 0,
      projected_redemptions REAL NOT NULL DEFAULT 0,
      baseline_revenue REAL NOT NULL DEFAULT 0,
      strategy_notes_json TEXT,
      agent_trace_json TEXT,
      location TEXT,
      context_json TEXT,
      brand_json TEXT,
      marketplace_json TEXT,
      sales_json TEXT,
      created_at TEXT NOT NULL,
      published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS campaign_days (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      day_index INTEGER NOT NULL,
      date TEXT NOT NULL,
      dow TEXT NOT NULL,
      daypart TEXT NOT NULL,
      discount_window TEXT NOT NULL,
      item TEXT NOT NULL,
      pct_off REAL NOT NULL,
      projected_redemptions REAL NOT NULL,
      projected_revenue REAL NOT NULL,
      copy TEXT NOT NULL,
      creative_url TEXT NOT NULL,
      rationale TEXT NOT NULL DEFAULT '',
      weather_json TEXT,
      event_json TEXT,
      context_note TEXT,
      expected_covers REAL NOT NULL DEFAULT 0,
      edited INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_days_campaign ON campaign_days(campaign_id);

    -- read-only mirror of the existing consumer marketplace
    CREATE TABLE IF NOT EXISTS marketplace_signals (
      restaurant_key TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
  `);

  // Lightweight migrations for pre-existing databases.
  const migrate = (table: string, cols: string[]) => {
    for (const col of cols) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col}`);
      } catch {
        /* column already exists */
      }
    }
  };
  migrate("campaigns", ["agent_trace_json TEXT", "location TEXT", "context_json TEXT"]);
  migrate("campaign_days", [
    "weather_json TEXT",
    "event_json TEXT",
    "context_note TEXT",
    "expected_covers REAL NOT NULL DEFAULT 0",
  ]);
}

// ------------------------------------------------------------
// Row <-> domain mappers
// ------------------------------------------------------------
type CampaignRow = {
  id: string;
  restaurant_id: string;
  slug: string;
  restaurant_slug: string;
  restaurant_name: string;
  month: string;
  start_date: string;
  title: string;
  status: string;
  paused: number;
  archived: number;
  projected_revenue: number;
  projected_redemptions: number;
  baseline_revenue: number;
  strategy_notes_json: string | null;
  agent_trace_json: string | null;
  location: string | null;
  context_json: string | null;
  brand_json: string | null;
  marketplace_json: string | null;
  sales_json: string | null;
  created_at: string;
  published_at: string | null;
};

function rowToCampaign(r: CampaignRow): Campaign {
  return {
    id: r.id,
    restaurant_id: r.restaurant_id,
    slug: r.slug,
    restaurant_slug: r.restaurant_slug,
    restaurant_name: r.restaurant_name,
    month: r.month,
    start_date: r.start_date,
    title: r.title,
    status: r.status as Campaign["status"],
    paused: !!r.paused,
    projected_revenue: r.projected_revenue,
    projected_redemptions: r.projected_redemptions,
    baseline_revenue: r.baseline_revenue,
    strategy_notes: r.strategy_notes_json ? JSON.parse(r.strategy_notes_json) : [],
    agent_trace: r.agent_trace_json ? JSON.parse(r.agent_trace_json) : [],
    location: r.location ?? null,
    context: r.context_json ? JSON.parse(r.context_json) : null,
    brand: r.brand_json ? JSON.parse(r.brand_json) : ({} as BrandKit),
    marketplace: r.marketplace_json ? JSON.parse(r.marketplace_json) : ({} as MarketplaceSignals),
    sales_summary: r.sales_json ? JSON.parse(r.sales_json) : ({} as ParsedSalesSummary),
    created_at: r.created_at,
    published_at: r.published_at,
  };
}

function rowToDay(r: Record<string, unknown>): CampaignDay {
  return {
    id: r.id as string,
    campaign_id: r.campaign_id as string,
    day_index: r.day_index as number,
    date: r.date as string,
    dow: r.dow as CampaignDay["dow"],
    daypart: r.daypart as CampaignDay["daypart"],
    discount_window: r.discount_window as string,
    item: r.item as string,
    pct_off: r.pct_off as number,
    projected_redemptions: r.projected_redemptions as number,
    projected_revenue: r.projected_revenue as number,
    copy: r.copy as string,
    creative_url: r.creative_url as string,
    rationale: (r.rationale as string) ?? "",
    weather: r.weather_json ? JSON.parse(r.weather_json as string) : null,
    event: r.event_json ? JSON.parse(r.event_json as string) : null,
    context_note: (r.context_note as string) ?? null,
    expected_covers: (r.expected_covers as number) ?? 0,
    edited: !!r.edited,
  };
}

// ------------------------------------------------------------
// Repository
// ------------------------------------------------------------
export const repo = {
  upsertRestaurant(input: {
    id: string;
    slug: string;
    name: string;
    website_url?: string | null;
    brand?: BrandKit;
    marketplace?: MarketplaceSignals;
    sales?: ParsedSalesSummary;
  }) {
    const db = getDb();
    db.prepare(
      `INSERT INTO restaurants (id, slug, name, website_url, brand_json, marketplace_json, sales_json, created_at)
       VALUES (@id, @slug, @name, @website_url, @brand_json, @marketplace_json, @sales_json, @created_at)
       ON CONFLICT(slug) DO UPDATE SET
         name=excluded.name,
         website_url=excluded.website_url,
         brand_json=excluded.brand_json,
         marketplace_json=excluded.marketplace_json,
         sales_json=excluded.sales_json`
    ).run({
      id: input.id,
      slug: input.slug,
      name: input.name,
      website_url: input.website_url ?? null,
      brand_json: input.brand ? JSON.stringify(input.brand) : null,
      marketplace_json: input.marketplace ? JSON.stringify(input.marketplace) : null,
      sales_json: input.sales ? JSON.stringify(input.sales) : null,
      created_at: new Date().toISOString(),
    });
  },

  createCampaign(campaign: Campaign, days: CampaignDay[]) {
    const db = getDb();
    const insertCampaign = db.prepare(`
      INSERT INTO campaigns (
        id, restaurant_id, slug, restaurant_slug, restaurant_name, month, start_date, title,
        status, paused, archived, projected_revenue, projected_redemptions, baseline_revenue,
        strategy_notes_json, agent_trace_json, location, context_json, brand_json, marketplace_json, sales_json, created_at, published_at
      ) VALUES (
        @id, @restaurant_id, @slug, @restaurant_slug, @restaurant_name, @month, @start_date, @title,
        @status, @paused, 0, @projected_revenue, @projected_redemptions, @baseline_revenue,
        @strategy_notes_json, @agent_trace_json, @location, @context_json, @brand_json, @marketplace_json, @sales_json, @created_at, @published_at
      )
    `);
    const insertDay = db.prepare(`
      INSERT INTO campaign_days (
        id, campaign_id, day_index, date, dow, daypart, discount_window, item, pct_off,
        projected_redemptions, projected_revenue, copy, creative_url, rationale,
        weather_json, event_json, context_note, expected_covers, edited
      ) VALUES (
        @id, @campaign_id, @day_index, @date, @dow, @daypart, @discount_window, @item, @pct_off,
        @projected_redemptions, @projected_revenue, @copy, @creative_url, @rationale,
        @weather_json, @event_json, @context_note, @expected_covers, @edited
      )
    `);
    const tx = db.transaction(() => {
      // Regenerate replaces: drop any prior campaign with the same public slug.
      db.prepare(`DELETE FROM campaigns WHERE slug = ?`).run(campaign.slug);
      insertCampaign.run({
        id: campaign.id,
        restaurant_id: campaign.restaurant_id,
        slug: campaign.slug,
        restaurant_slug: campaign.restaurant_slug,
        restaurant_name: campaign.restaurant_name,
        month: campaign.month,
        start_date: campaign.start_date,
        title: campaign.title,
        status: campaign.status,
        paused: campaign.paused ? 1 : 0,
        projected_revenue: campaign.projected_revenue,
        projected_redemptions: campaign.projected_redemptions,
        baseline_revenue: campaign.baseline_revenue,
        strategy_notes_json: JSON.stringify(campaign.strategy_notes),
        agent_trace_json: JSON.stringify(campaign.agent_trace ?? []),
        location: campaign.location ?? null,
        context_json: campaign.context ? JSON.stringify(campaign.context) : null,
        brand_json: JSON.stringify(campaign.brand),
        marketplace_json: JSON.stringify(campaign.marketplace),
        sales_json: JSON.stringify(campaign.sales_summary),
        created_at: campaign.created_at,
        published_at: campaign.published_at,
      });
      for (const d of days) {
        insertDay.run({
          id: d.id,
          campaign_id: d.campaign_id,
          day_index: d.day_index,
          date: d.date,
          dow: d.dow,
          daypart: d.daypart,
          discount_window: d.discount_window,
          item: d.item,
          pct_off: d.pct_off,
          projected_redemptions: d.projected_redemptions,
          projected_revenue: d.projected_revenue,
          copy: d.copy,
          creative_url: d.creative_url,
          rationale: d.rationale,
          weather_json: d.weather ? JSON.stringify(d.weather) : null,
          event_json: d.event ? JSON.stringify(d.event) : null,
          context_note: d.context_note ?? null,
          expected_covers: d.expected_covers ?? 0,
          edited: d.edited ? 1 : 0,
        });
      }
    });
    tx();
  },

  getCampaignBySlug(slug: string): CampaignWithDays | null {
    const db = getDb();
    const row = db
      .prepare(`SELECT * FROM campaigns WHERE slug = ? AND archived = 0`)
      .get(slug) as CampaignRow | undefined;
    if (!row) return null;
    const days = (db
      .prepare(`SELECT * FROM campaign_days WHERE campaign_id = ? ORDER BY day_index ASC`)
      .all(row.id) as Record<string, unknown>[]).map(rowToDay);
    return { ...rowToCampaign(row), days };
  },

  getCampaignById(id: string): CampaignWithDays | null {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id) as
      | CampaignRow
      | undefined;
    if (!row) return null;
    const days = (db
      .prepare(`SELECT * FROM campaign_days WHERE campaign_id = ? ORDER BY day_index ASC`)
      .all(row.id) as Record<string, unknown>[]).map(rowToDay);
    return { ...rowToCampaign(row), days };
  },

  getDayById(id: string): CampaignDay | null {
    const row = getDb().prepare(`SELECT * FROM campaign_days WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToDay(row) : null;
  },

  listCampaigns(): Campaign[] {
    const db = getDb();
    const rows = db
      .prepare(`SELECT * FROM campaigns WHERE archived = 0 ORDER BY created_at DESC`)
      .all() as CampaignRow[];
    return rows.map(rowToCampaign);
  },

  updateDay(id: string, patch: Partial<CampaignDay>): CampaignDay | null {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM campaign_days WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return null;
    const merged = { ...rowToDay(existing), ...patch, edited: true };
    db.prepare(
      `UPDATE campaign_days SET
        daypart=@daypart, discount_window=@discount_window, item=@item, pct_off=@pct_off,
        projected_redemptions=@projected_redemptions, projected_revenue=@projected_revenue,
        copy=@copy, creative_url=@creative_url, rationale=@rationale, edited=1
       WHERE id=@id`
    ).run({
      id,
      daypart: merged.daypart,
      discount_window: merged.discount_window,
      item: merged.item,
      pct_off: merged.pct_off,
      projected_redemptions: merged.projected_redemptions,
      projected_revenue: merged.projected_revenue,
      copy: merged.copy,
      creative_url: merged.creative_url,
      rationale: merged.rationale,
    });
    this.recomputeCampaignTotals(merged.campaign_id);
    return merged;
  },

  recomputeCampaignTotals(campaignId: string) {
    const db = getDb();
    const agg = db
      .prepare(
        `SELECT COALESCE(SUM(projected_revenue),0) rev, COALESCE(SUM(projected_redemptions),0) red
         FROM campaign_days WHERE campaign_id = ?`
      )
      .get(campaignId) as { rev: number; red: number };
    db.prepare(
      `UPDATE campaigns SET projected_revenue=?, projected_redemptions=? WHERE id=?`
    ).run(agg.rev, agg.red, campaignId);
  },

  setPaused(id: string, paused: boolean) {
    getDb().prepare(`UPDATE campaigns SET paused=? WHERE id=?`).run(paused ? 1 : 0, id);
  },

  publish(id: string) {
    getDb()
      .prepare(`UPDATE campaigns SET status='published', published_at=? WHERE id=?`)
      .run(new Date().toISOString(), id);
  },

  archive(id: string) {
    getDb().prepare(`UPDATE campaigns SET archived=1 WHERE id=?`).run(id);
  },

  deleteCampaign(id: string) {
    getDb().prepare(`DELETE FROM campaigns WHERE id=?`).run(id);
  },

  getMarketplaceSignal(key: string): MarketplaceSignals | null {
    const row = getDb()
      .prepare(`SELECT json FROM marketplace_signals WHERE restaurant_key = ?`)
      .get(key) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as MarketplaceSignals) : null;
  },

  putMarketplaceSignal(key: string, signal: MarketplaceSignals) {
    getDb()
      .prepare(
        `INSERT INTO marketplace_signals (restaurant_key, json) VALUES (?, ?)
         ON CONFLICT(restaurant_key) DO UPDATE SET json=excluded.json`
      )
      .run(key, JSON.stringify(signal));
  },
};

export { getDb };
