import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  Campaign,
  CampaignDay,
  CampaignWithDays,
  CampaignRun,
  BrandKit,
  MarketplaceSignals,
  ParsedSalesSummary,
  Subscription,
  User,
} from "./types";

// ============================================================
// Data layer — Postgres.
//   • Local dev: PGlite (embedded Postgres, no server, WASM)
//   • Production: Neon / any Postgres via DATABASE_URL
// Same SQL both places. No native modules → serverless-friendly.
// ============================================================

type Row = Record<string, unknown>;
type Client = { query: (text: string, params?: unknown[]) => Promise<{ rows: Row[] }> };

type Backend = {
  client: Client;
  kind: "pglite" | "neon";
  ready: Promise<void>;
};

const g = globalThis as unknown as { __swell_pg?: Backend };

function connectionString(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

async function makeBackend(): Promise<Backend> {
  const url = connectionString();
  if (url) {
    const { Pool } = await import("@neondatabase/serverless");
    const pool = new Pool({ connectionString: url });
    const client: Client = { query: (text, params) => pool.query(text, params) };
    const backend: Backend = { client, kind: "neon", ready: Promise.resolve() };
    backend.ready = init(client, "neon");
    return backend;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  // IMPORTANT: store DB files OUTSIDE the project directory. The Next dev
  // watcher reloads the browser on any file change, and live Postgres files
  // change on every query — keeping them under ./data caused a reload loop.
  const base = process.env.SWELL_DATA_DIR || path.join(os.homedir(), ".swell");
  let dir = path.join(base, "pg");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    dir = path.join("/tmp", "swell-pg");
    fs.mkdirSync(dir, { recursive: true });
  }
  const pg = new PGlite(dir);
  const client: Client = { query: (text, params) => pg.query(text, params as unknown[]) };
  const backend: Backend = { client, kind: "pglite", ready: Promise.resolve() };
  backend.ready = init(client, "pglite");
  return backend;
}

function getBackend(): Backend {
  if (!g.__swell_pg) {
    // Kick off connection + init once; queries await ready.
    const b: Backend = { client: null as unknown as Client, kind: "pglite", ready: Promise.resolve() };
    g.__swell_pg = b;
    b.ready = makeBackend().then((real) => {
      b.client = real.client;
      b.kind = real.kind;
      return real.ready;
    });
  }
  return g.__swell_pg;
}

async function q(text: string, params: unknown[] = []): Promise<Row[]> {
  const b = getBackend();
  await b.ready;
  const { rows } = await b.client.query(text, params);
  return rows;
}
async function one(text: string, params: unknown[] = []): Promise<Row | null> {
  const rows = await q(text, params);
  return rows[0] ?? null;
}

/** Run a set of statements in a transaction (used for regenerate-replaces). */
async function withTx(fn: (run: (t: string, p?: unknown[]) => Promise<void>) => Promise<void>) {
  const b = getBackend();
  await b.ready;
  const run = async (t: string, p: unknown[] = []) => {
    await b.client.query(t, p);
  };
  await b.client.query("BEGIN");
  try {
    await fn(run);
    await b.client.query("COMMIT");
  } catch (e) {
    await b.client.query("ROLLBACK");
    throw e;
  }
}

async function init(client: Client, kind: Backend["kind"]): Promise<void> {
  const exec = (t: string) => client.query(t);
  await exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      website_url TEXT,
      brand_json TEXT,
      marketplace_json TEXT,
      sales_json TEXT,
      created_at TEXT NOT NULL
    )`);
  await exec(`
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
    )`);
  await exec(`
    CREATE TABLE IF NOT EXISTS campaign_days (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
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
      edited INTEGER NOT NULL DEFAULT 0
    )`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_days_campaign ON campaign_days(campaign_id)`);
  // Every generation, kept even after the campaign it produced is replaced.
  // Regenerating overwrites the campaign (the public URL must stay stable),
  // so this is the only record that a given run ever happened.
  await exec(`
    CREATE TABLE IF NOT EXISTS campaign_runs (
      id TEXT PRIMARY KEY,
      email TEXT,
      campaign_id TEXT NOT NULL,
      campaign_slug TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      location TEXT,
      created_at TEXT NOT NULL,
      duration_ms REAL NOT NULL DEFAULT 0,
      baseline_revenue REAL NOT NULL DEFAULT 0,
      projected_low REAL NOT NULL DEFAULT 0,
      projected_expected REAL NOT NULL DEFAULT 0,
      projected_high REAL NOT NULL DEFAULT 0,
      confidence TEXT NOT NULL DEFAULT 'moderate',
      checks_passed INTEGER NOT NULL DEFAULT 0,
      checks_total INTEGER NOT NULL DEFAULT 0,
      forecast_days INTEGER NOT NULL DEFAULT 0,
      seasonal_days INTEGER NOT NULL DEFAULT 0,
      event_days INTEGER NOT NULL DEFAULT 0
    )`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_runs_email ON campaign_runs(email, created_at)`);
  // Fixed-window rate-limit counters, shared across every serverless instance.
  await exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT NOT NULL,
      window_start BIGINT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key, window_start)
    )`);
  await exec(`
    CREATE TABLE IF NOT EXISTS marketplace_signals (
      restaurant_key TEXT PRIMARY KEY,
      json TEXT NOT NULL
    )`);
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      restaurant_name TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
  await exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      email TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      "interval" TEXT NOT NULL DEFAULT 'monthly',
      status TEXT NOT NULL DEFAULT 'active',
      mode TEXT NOT NULL DEFAULT 'demo',
      current_period_end TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
  // Idempotent migrations (Postgres supports IF NOT EXISTS on ADD COLUMN)
  const cols: Array<[string, string]> = [
    ["campaigns", "agent_trace_json TEXT"],
    ["campaigns", "location TEXT"],
    ["campaigns", "context_json TEXT"],
    ["campaign_days", "weather_json TEXT"],
    ["campaign_days", "event_json TEXT"],
    ["campaign_days", "context_note TEXT"],
    ["campaign_days", "expected_covers REAL NOT NULL DEFAULT 0"],
    ["campaigns", "owner_email TEXT"],
  ];
  for (const [table, col] of cols) {
    try {
      await exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col}`);
    } catch {
      /* older engines */
    }
  }

  // Tenant isolation backfill: campaigns created before owner_email existed
  // get their owner from the run log, which has always recorded who generated
  // what. Rows with no run (the system demo) stay NULL = read-only for all.
  await exec(`
    UPDATE campaigns c SET owner_email = r.email
    FROM campaign_runs r
    WHERE c.owner_email IS NULL AND r.campaign_id = c.id AND r.email IS NOT NULL`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_email, created_at)`);
  void kind;
}

// ------------------------------------------------------------
// Row -> domain mappers
// ------------------------------------------------------------
function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}
function parse<T>(v: unknown, fallback: T): T {
  return v ? (JSON.parse(v as string) as T) : fallback;
}

function rowToCampaign(r: Row): Campaign {
  return {
    id: r.id as string,
    owner_email: (r.owner_email as string) ?? null,
    restaurant_id: r.restaurant_id as string,
    slug: r.slug as string,
    restaurant_slug: r.restaurant_slug as string,
    restaurant_name: r.restaurant_name as string,
    month: r.month as string,
    start_date: r.start_date as string,
    title: r.title as string,
    status: r.status as Campaign["status"],
    paused: !!num(r.paused),
    projected_revenue: num(r.projected_revenue),
    projected_redemptions: num(r.projected_redemptions),
    baseline_revenue: num(r.baseline_revenue),
    strategy_notes: parse(r.strategy_notes_json, [] as string[]),
    agent_trace: parse(r.agent_trace_json, [] as Campaign["agent_trace"]),
    location: (r.location as string) ?? null,
    context: parse(r.context_json, null as Campaign["context"]),
    brand: parse(r.brand_json, {} as BrandKit),
    marketplace: parse(r.marketplace_json, {} as MarketplaceSignals),
    sales_summary: parse(r.sales_json, {} as ParsedSalesSummary),
    created_at: r.created_at as string,
    published_at: (r.published_at as string) ?? null,
  };
}

function rowToDay(r: Row): CampaignDay {
  return {
    id: r.id as string,
    campaign_id: r.campaign_id as string,
    day_index: num(r.day_index),
    date: r.date as string,
    dow: r.dow as CampaignDay["dow"],
    daypart: r.daypart as CampaignDay["daypart"],
    discount_window: r.discount_window as string,
    item: r.item as string,
    pct_off: num(r.pct_off),
    projected_redemptions: num(r.projected_redemptions),
    projected_revenue: num(r.projected_revenue),
    copy: r.copy as string,
    creative_url: r.creative_url as string,
    rationale: (r.rationale as string) ?? "",
    weather: parse(r.weather_json, null as CampaignDay["weather"]),
    event: parse(r.event_json, null as CampaignDay["event"]),
    context_note: (r.context_note as string) ?? null,
    expected_covers: num(r.expected_covers),
    edited: !!num(r.edited),
  };
}

// ------------------------------------------------------------
// Repository (async)
// ------------------------------------------------------------
export const repo = {
  async upsertRestaurant(input: {
    id: string;
    slug: string;
    name: string;
    website_url?: string | null;
    brand?: BrandKit;
    marketplace?: MarketplaceSignals;
    sales?: ParsedSalesSummary;
  }): Promise<void> {
    await q(
      `INSERT INTO restaurants (id, slug, name, website_url, brand_json, marketplace_json, sales_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(slug) DO UPDATE SET
         name=EXCLUDED.name, website_url=EXCLUDED.website_url, brand_json=EXCLUDED.brand_json,
         marketplace_json=EXCLUDED.marketplace_json, sales_json=EXCLUDED.sales_json`,
      [
        input.id,
        input.slug,
        input.name,
        input.website_url ?? null,
        input.brand ? JSON.stringify(input.brand) : null,
        input.marketplace ? JSON.stringify(input.marketplace) : null,
        input.sales ? JSON.stringify(input.sales) : null,
        new Date().toISOString(),
      ]
    );
  },

  /**
   * Who owns a slug right now? `undefined` = slug is free; `null` = owned by
   * the system (demo). Used to stop one tenant's regenerate from replacing
   * another tenant's campaign that happens to share a restaurant name.
   */
  async slugOwner(slug: string): Promise<string | null | undefined> {
    const row = await one(`SELECT owner_email FROM campaigns WHERE slug=$1`, [slug]);
    if (!row) return undefined;
    return (row.owner_email as string) ?? null;
  },

  async createCampaign(campaign: Campaign, days: CampaignDay[]): Promise<void> {
    await withTx(async (run) => {
      // Regenerate replaces ONLY the same owner's campaign at this slug —
      // never someone else's. (IS NOT DISTINCT FROM makes NULL = NULL for
      // the system-owned demo.)
      await run(`DELETE FROM campaigns WHERE slug = $1 AND owner_email IS NOT DISTINCT FROM $2`, [
        campaign.slug,
        campaign.owner_email,
      ]);
      await run(
        `INSERT INTO campaigns (
          id, restaurant_id, slug, restaurant_slug, restaurant_name, month, start_date, title,
          status, paused, archived, projected_revenue, projected_redemptions, baseline_revenue,
          strategy_notes_json, agent_trace_json, location, context_json,
          brand_json, marketplace_json, sales_json, created_at, published_at, owner_email
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [
          campaign.id,
          campaign.restaurant_id,
          campaign.slug,
          campaign.restaurant_slug,
          campaign.restaurant_name,
          campaign.month,
          campaign.start_date,
          campaign.title,
          campaign.status,
          campaign.paused ? 1 : 0,
          campaign.projected_revenue,
          campaign.projected_redemptions,
          campaign.baseline_revenue,
          JSON.stringify(campaign.strategy_notes),
          JSON.stringify(campaign.agent_trace ?? []),
          campaign.location ?? null,
          campaign.context ? JSON.stringify(campaign.context) : null,
          JSON.stringify(campaign.brand),
          JSON.stringify(campaign.marketplace),
          JSON.stringify(campaign.sales_summary),
          campaign.created_at,
          campaign.published_at,
          campaign.owner_email,
        ]
      );
      for (const d of days) {
        await run(
          `INSERT INTO campaign_days (
            id, campaign_id, day_index, date, dow, daypart, discount_window, item, pct_off,
            projected_redemptions, projected_revenue, copy, creative_url, rationale,
            weather_json, event_json, context_note, expected_covers, edited
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [
            d.id,
            d.campaign_id,
            d.day_index,
            d.date,
            d.dow,
            d.daypart,
            d.discount_window,
            d.item,
            d.pct_off,
            d.projected_redemptions,
            d.projected_revenue,
            d.copy,
            d.creative_url,
            d.rationale,
            d.weather ? JSON.stringify(d.weather) : null,
            d.event ? JSON.stringify(d.event) : null,
            d.context_note ?? null,
            d.expected_covers ?? 0,
            d.edited ? 1 : 0,
          ]
        );
      }
    });
  },

  async getCampaignBySlug(slug: string): Promise<CampaignWithDays | null> {
    const row = await one(`SELECT * FROM campaigns WHERE slug=$1 AND archived=0`, [slug]);
    if (!row) return null;
    const days = (
      await q(`SELECT * FROM campaign_days WHERE campaign_id=$1 ORDER BY day_index ASC`, [row.id])
    ).map(rowToDay);
    return { ...rowToCampaign(row), days };
  },

  async getCampaignById(id: string): Promise<CampaignWithDays | null> {
    const row = await one(`SELECT * FROM campaigns WHERE id=$1`, [id]);
    if (!row) return null;
    const days = (
      await q(`SELECT * FROM campaign_days WHERE campaign_id=$1 ORDER BY day_index ASC`, [row.id])
    ).map(rowToDay);
    return { ...rowToCampaign(row), days };
  },

  async getDayById(id: string): Promise<CampaignDay | null> {
    const row = await one(`SELECT * FROM campaign_days WHERE id=$1`, [id]);
    return row ? rowToDay(row) : null;
  },

  /**
   * Atomically count one hit against a fixed window and return the new total.
   * The upsert is a single statement, so concurrent requests can't both slip
   * under the limit. Old windows are swept opportunistically.
   */
  /** Round-trips the database. Returns which backend answered. */
  async ping(): Promise<Backend["kind"]> {
    await one(`SELECT 1 AS ok`, []);
    return getBackend().kind;
  },

  async hitRateLimit(key: string, windowStart: number): Promise<number> {
    const row = await one(
      `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
       RETURNING count`,
      [key, windowStart]
    );
    if (Math.random() < 0.01) {
      // ~1% of hits prune windows older than a day. Cheap, bounded, never blocks.
      void q(`DELETE FROM rate_limits WHERE window_start < $1`, [Date.now() - 86_400_000]).catch(() => {});
    }
    return num(row?.count);
  },

  /** One tenant's campaigns — never anyone else's. */
  async listCampaigns(ownerEmail: string): Promise<Campaign[]> {
    const rows = await q(
      `SELECT * FROM campaigns WHERE archived=0 AND owner_email=$1 ORDER BY created_at DESC`,
      [ownerEmail.toLowerCase()]
    );
    return rows.map(rowToCampaign);
  },

  async updateDay(id: string, patch: Partial<CampaignDay>): Promise<CampaignDay | null> {
    const existing = await one(`SELECT * FROM campaign_days WHERE id=$1`, [id]);
    if (!existing) return null;
    const merged = { ...rowToDay(existing), ...patch, edited: true };
    await q(
      `UPDATE campaign_days SET
        daypart=$1, discount_window=$2, item=$3, pct_off=$4,
        projected_redemptions=$5, projected_revenue=$6, copy=$7, creative_url=$8,
        rationale=$9, edited=1
       WHERE id=$10`,
      [
        merged.daypart,
        merged.discount_window,
        merged.item,
        merged.pct_off,
        merged.projected_redemptions,
        merged.projected_revenue,
        merged.copy,
        merged.creative_url,
        merged.rationale,
        id,
      ]
    );
    await this.recomputeCampaignTotals(merged.campaign_id);
    return merged;
  },

  async recomputeCampaignTotals(campaignId: string): Promise<void> {
    const agg = await one(
      `SELECT COALESCE(SUM(projected_revenue),0) rev, COALESCE(SUM(projected_redemptions),0) red
       FROM campaign_days WHERE campaign_id=$1`,
      [campaignId]
    );
    await q(`UPDATE campaigns SET projected_revenue=$1, projected_redemptions=$2 WHERE id=$3`, [
      num(agg?.rev),
      num(agg?.red),
      campaignId,
    ]);
  },

  async setPaused(id: string, paused: boolean): Promise<void> {
    await q(`UPDATE campaigns SET paused=$1 WHERE id=$2`, [paused ? 1 : 0, id]);
  },

  async publish(id: string): Promise<void> {
    await q(`UPDATE campaigns SET status='published', published_at=$1 WHERE id=$2`, [
      new Date().toISOString(),
      id,
    ]);
  },

  async archive(id: string): Promise<void> {
    await q(`UPDATE campaigns SET archived=1 WHERE id=$1`, [id]);
  },

  async deleteCampaign(id: string): Promise<void> {
    await q(`DELETE FROM campaigns WHERE id=$1`, [id]);
  },

  // ---- run history ----
  async recordRun(run: CampaignRun): Promise<void> {
    await q(
      `INSERT INTO campaign_runs (
        id, email, campaign_id, campaign_slug, restaurant_name, location, created_at,
        duration_ms, baseline_revenue, projected_low, projected_expected, projected_high,
        confidence, checks_passed, checks_total, forecast_days, seasonal_days, event_days
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        run.id,
        run.email,
        run.campaign_id,
        run.campaign_slug,
        run.restaurant_name,
        run.location,
        run.created_at,
        run.duration_ms,
        run.baseline_revenue,
        run.projected_low,
        run.projected_expected,
        run.projected_high,
        run.confidence,
        run.checks_passed,
        run.checks_total,
        run.forecast_days,
        run.seasonal_days,
        run.event_days,
      ]
    );
  },

  async listRuns(email: string, limit = 20): Promise<CampaignRun[]> {
    const rows = await q(
      `SELECT * FROM campaign_runs WHERE email=$1 ORDER BY created_at DESC LIMIT $2`,
      [email.toLowerCase(), limit]
    );
    return rows.map((r) => ({
      id: r.id as string,
      email: (r.email as string) ?? null,
      campaign_id: r.campaign_id as string,
      campaign_slug: r.campaign_slug as string,
      restaurant_name: r.restaurant_name as string,
      location: (r.location as string) ?? null,
      created_at: r.created_at as string,
      duration_ms: num(r.duration_ms),
      baseline_revenue: num(r.baseline_revenue),
      projected_low: num(r.projected_low),
      projected_expected: num(r.projected_expected),
      projected_high: num(r.projected_high),
      confidence: r.confidence as CampaignRun["confidence"],
      checks_passed: num(r.checks_passed),
      checks_total: num(r.checks_total),
      forecast_days: num(r.forecast_days),
      seasonal_days: num(r.seasonal_days),
      event_days: num(r.event_days),
    }));
  },

  async getMarketplaceSignal(key: string): Promise<MarketplaceSignals | null> {
    const row = await one(`SELECT json FROM marketplace_signals WHERE restaurant_key=$1`, [key]);
    return row ? (JSON.parse(row.json as string) as MarketplaceSignals) : null;
  },

  async putMarketplaceSignal(key: string, signal: MarketplaceSignals): Promise<void> {
    await q(
      `INSERT INTO marketplace_signals (restaurant_key, json) VALUES ($1,$2)
       ON CONFLICT(restaurant_key) DO UPDATE SET json=EXCLUDED.json`,
      [key, JSON.stringify(signal)]
    );
  },

  // ---- users (auth) ----
  async createUser(input: {
    email: string;
    name: string;
    restaurant_name?: string | null;
    password_hash: string;
  }): Promise<void> {
    await q(
      `INSERT INTO users (email, name, restaurant_name, password_hash, created_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        input.email.toLowerCase(),
        input.name,
        input.restaurant_name ?? null,
        input.password_hash,
        new Date().toISOString(),
      ]
    );
  },

  async getUserWithHash(
    email: string
  ): Promise<{ user: User; password_hash: string } | null> {
    const row = await one(`SELECT * FROM users WHERE email=$1`, [email.toLowerCase()]);
    if (!row) return null;
    return {
      user: {
        email: row.email as string,
        name: row.name as string,
        restaurant_name: (row.restaurant_name as string) ?? null,
        created_at: row.created_at as string,
      },
      password_hash: row.password_hash as string,
    };
  },

  async getUser(email: string): Promise<User | null> {
    const found = await this.getUserWithHash(email);
    return found?.user ?? null;
  },

  // ---- subscriptions ----
  async getSubscription(email: string): Promise<Subscription | null> {
    const row = await one(`SELECT * FROM subscriptions WHERE email=$1`, [email.toLowerCase()]);
    if (!row) return null;
    return {
      email: row.email as string,
      plan: row.plan as Subscription["plan"],
      interval: row.interval as Subscription["interval"],
      status: row.status as Subscription["status"],
      mode: row.mode as Subscription["mode"],
      current_period_end: (row.current_period_end as string) ?? null,
      stripe_customer_id: (row.stripe_customer_id as string) ?? null,
      stripe_subscription_id: (row.stripe_subscription_id as string) ?? null,
    };
  },

  async upsertSubscription(sub: Subscription): Promise<void> {
    const now = new Date().toISOString();
    await q(
      `INSERT INTO subscriptions
        (email, plan, "interval", status, mode, current_period_end, stripe_customer_id, stripe_subscription_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       ON CONFLICT(email) DO UPDATE SET
         plan=EXCLUDED.plan, "interval"=EXCLUDED."interval", status=EXCLUDED.status, mode=EXCLUDED.mode,
         current_period_end=EXCLUDED.current_period_end, stripe_customer_id=EXCLUDED.stripe_customer_id,
         stripe_subscription_id=EXCLUDED.stripe_subscription_id, updated_at=EXCLUDED.updated_at`,
      [
        sub.email.toLowerCase(),
        sub.plan,
        sub.interval,
        sub.status,
        sub.mode,
        sub.current_period_end,
        sub.stripe_customer_id,
        sub.stripe_subscription_id,
        now,
      ]
    );
  },

  async getSubscriptionByStripeId(subId: string): Promise<Subscription | null> {
    const row = await one(`SELECT email FROM subscriptions WHERE stripe_subscription_id=$1`, [subId]);
    return row ? this.getSubscription(row.email as string) : null;
  },

  /** An owner's live campaigns — the input to plan limits (billing/quota.ts). */
  async ownedCampaigns(
    ownerEmail: string
  ): Promise<{ slug: string; restaurant_slug: string; created_at: string }[]> {
    const rows = await q(
      `SELECT slug, restaurant_slug, created_at FROM campaigns WHERE owner_email=$1 AND archived=0`,
      [ownerEmail]
    );
    return rows.map((r) => ({
      slug: r.slug as string,
      restaurant_slug: r.restaurant_slug as string,
      created_at: r.created_at as string,
    }));
  },

  async countCampaignsThisMonth(): Promise<number> {
    const prefix = new Date().toISOString().slice(0, 7);
    const row = await one(`SELECT COUNT(*) c FROM campaigns WHERE substr(created_at,1,7)=$1`, [prefix]);
    return num(row?.c);
  },
};
