import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ProofReport } from "./proof";
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
type Query = (text: string, params?: unknown[]) => Promise<{ rows: Row[] }>;
type Client = {
  query: Query;
  /**
   * Run `fn` inside ONE transaction on ONE connection. With a pool, sending
   * BEGIN / statements / COMMIT as separate pool.query calls can land each on
   * a different connection — no atomicity, and a connection returned to the
   * pool mid-transaction. Each backend implements this correctly.
   */
  transaction: <T>(fn: (query: Query) => Promise<T>) => Promise<T>;
};

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
    const client: Client = {
      query: (text, params) => pool.query(text, params),
      transaction: async (fn) => {
        const conn = await pool.connect();
        try {
          await conn.query("BEGIN");
          const result = await fn((text, params) => conn.query(text, params));
          await conn.query("COMMIT");
          return result;
        } catch (e) {
          await conn.query("ROLLBACK").catch(() => {});
          throw e;
        } finally {
          conn.release();
        }
      },
    };
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
  const client: Client = {
    query: (text, params) => pg.query(text, params as unknown[]),
    // PGlite's own transaction API serialises it against other queries.
    transaction: (fn) => pg.transaction((tx) => fn((text, params) => tx.query(text, params as unknown[]))),
  };
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

/** Run a set of statements atomically, on a single connection. */
async function withTx(fn: (run: (t: string, p?: unknown[]) => Promise<void>) => Promise<void>) {
  const b = getBackend();
  await b.ready;
  await b.client.transaction(async (query) => {
    await fn(async (t, p = []) => {
      await query(t, p);
    });
  });
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
  // Referrals: one reward per referred restaurant, ever (PK), earned only
  // when that restaurant's own register proves a campaign worked.
  await exec(`
    CREATE TABLE IF NOT EXISTS referral_rewards (
      referred_email TEXT PRIMARY KEY,
      referrer_email TEXT NOT NULL,
      amount INTEGER NOT NULL,
      campaign_id TEXT,
      created_at TEXT NOT NULL
    )`);
  // Credit ledger: + earned, − applied. `ref` makes every entry idempotent.
  await exec(`
    CREATE TABLE IF NOT EXISTS credits (
      ref TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
  // Owners who asked to talk — founder-led sales starts here.
  await exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      restaurant TEXT,
      source TEXT NOT NULL,
      note TEXT,
      found_per_month INTEGER,
      created_at TEXT NOT NULL
    )`);
  // Pay-for-proof: one row per campaign, never two — the fee for a campaign
  // is updated while it's an estimate and frozen once invoiced.
  await exec(`
    CREATE TABLE IF NOT EXISTS performance_charges (
      campaign_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      slug TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      basis INTEGER NOT NULL,
      rate REAL NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      stripe_invoice_id TEXT,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
    ["campaigns", "proof_json TEXT"],
    ["subscriptions", "performance_rate REAL"],
    ["users", "referral_code TEXT"],
    ["users", "referred_by TEXT"],
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
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_credits_email ON credits(email)`);
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
    proof: parse(r.proof_json, null as Campaign["proof"]),
  };
}

export type Lead = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  restaurant: string | null;
  source: string;
  note: string | null;
  found_per_month: number | null;
  created_at: string;
};

export type PerformanceCharge = {
  campaign_id: string;
  email: string;
  slug: string;
  restaurant_name: string;
  basis: number;
  rate: number;
  amount: number;
  /** estimate → (campaign still running) · invoiced / demo → final · none → not proven */
  status: "estimate" | "invoiced" | "demo" | "credited" | "none" | "failed";
  stripe_invoice_id: string | null;
  reason: string;
  created_at: string;
  updated_at: string;
};

function rowToCharge(r: Row): PerformanceCharge {
  return {
    campaign_id: r.campaign_id as string,
    email: r.email as string,
    slug: r.slug as string,
    restaurant_name: r.restaurant_name as string,
    basis: num(r.basis),
    rate: num(r.rate),
    amount: num(r.amount),
    status: r.status as PerformanceCharge["status"],
    stripe_invoice_id: (r.stripe_invoice_id as string) ?? null,
    reason: r.reason as string,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
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
  /** Every real Proof report (the demo excluded) — only ever shown in aggregate. */
  async listProofs(): Promise<ProofReport[]> {
    const rows = await q(`SELECT proof_json FROM campaigns WHERE proof_json IS NOT NULL AND slug <> 'demo'`);
    return rows.map((r) => JSON.parse(r.proof_json as string) as ProofReport);
  },

  /** Save a Proof report (measured lift) on a campaign. */
  async setProof(campaignId: string, proof: unknown): Promise<void> {
    await q(`UPDATE campaigns SET proof_json=$2 WHERE id=$1`, [campaignId, JSON.stringify(proof)]);
  },

  // ---- founder dashboard ----
  async adminStats() {
    const n = async (sql: string, params: unknown[] = []) => num((await one(sql, params))?.c);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const [users, usersWeek, campaigns, campaignsWeek, published, proofs, proven, paying, performance, leads, billed, referred, referralWins] =
      await Promise.all([
        n(`SELECT COUNT(*) c FROM users`),
        n(`SELECT COUNT(*) c FROM users WHERE created_at >= $1`, [weekAgo]),
        n(`SELECT COUNT(*) c FROM campaigns WHERE slug <> 'demo'`),
        n(`SELECT COUNT(*) c FROM campaigns WHERE slug <> 'demo' AND created_at >= $1`, [weekAgo]),
        n(`SELECT COUNT(*) c FROM campaigns WHERE slug <> 'demo' AND status = 'published'`),
        n(`SELECT COUNT(*) c FROM campaigns WHERE slug <> 'demo' AND proof_json IS NOT NULL`),
        n(`SELECT COUNT(*) c FROM performance_charges WHERE status IN ('invoiced','demo','estimate')`),
        n(`SELECT COUNT(*) c FROM subscriptions WHERE status IN ('active','trialing') AND plan <> 'performance'`),
        n(`SELECT COUNT(*) c FROM subscriptions WHERE status IN ('active','trialing') AND plan = 'performance'`),
        n(`SELECT COUNT(*) c FROM leads`),
        n(`SELECT COALESCE(SUM(amount),0) c FROM performance_charges WHERE status = 'invoiced'`),
        n(`SELECT COUNT(*) c FROM users WHERE referred_by IS NOT NULL`),
        n(`SELECT COUNT(*) c FROM referral_rewards`),
      ]);
    const recentUsers = await q(`SELECT email, name, created_at FROM users ORDER BY created_at DESC LIMIT 15`);
    const recentCampaigns = await q(
      `SELECT slug, restaurant_name, owner_email, status, created_at, proof_json IS NOT NULL AS has_proof
         FROM campaigns WHERE slug <> 'demo' ORDER BY created_at DESC LIMIT 15`
    );
    return {
      users, usersWeek, campaigns, campaignsWeek, published, proofs, proven, paying, performance, leads, billed, referred, referralWins,
      recentUsers: recentUsers.map((r) => ({ email: r.email as string, name: r.name as string, created_at: r.created_at as string })),
      recentCampaigns: recentCampaigns.map((r) => ({
        slug: r.slug as string,
        restaurant: r.restaurant_name as string,
        owner: (r.owner_email as string) ?? null,
        status: r.status as string,
        created_at: r.created_at as string,
        hasProof: !!r.has_proof,
      })),
    };
  },

  // ---- account deletion ----
  /**
   * Erase an account's data in one transaction. Kept, anonymised: invoiced
   * pay-for-proof charges (financial records). Everything else goes —
   * campaigns, their days and stored sales summaries, run history, credits,
   * leads, the subscription row and the user row. Referral history of OTHER
   * accounts survives with this account anonymised.
   */
  async deleteAccountData(email: string): Promise<{ campaigns: number }> {
    const e = email.toLowerCase();
    const tag = `deleted:${randomUUID().slice(0, 8)}`;
    const owned = await q(`SELECT id, restaurant_id, restaurant_slug FROM campaigns WHERE owner_email=$1`, [e]);
    const ids = owned.map((r) => r.id as string);
    const restaurants = [...new Set(owned.map((r) => r.restaurant_id as string))];
    const slugs = [...new Set(owned.map((r) => r.restaurant_slug as string))];
    await withTx(async (run) => {
      if (ids.length) {
        await run(`DELETE FROM campaign_days WHERE campaign_id = ANY($1)`, [ids]);
        await run(`DELETE FROM campaigns WHERE id = ANY($1)`, [ids]);
      }
      if (restaurants.length) {
        await run(
          `DELETE FROM restaurants WHERE id = ANY($1) AND id NOT IN (SELECT restaurant_id FROM campaigns)`,
          [restaurants]
        );
      }
      if (slugs.length) {
        await run(
          `DELETE FROM marketplace_signals WHERE restaurant_key = ANY($1)
             AND restaurant_key NOT IN (SELECT restaurant_slug FROM campaigns)`,
          [slugs]
        );
      }
      await run(`DELETE FROM campaign_runs WHERE email=$1`, [e]);
      await run(`DELETE FROM credits WHERE email=$1`, [e]);
      await run(`DELETE FROM referral_rewards WHERE referred_email=$1`, [e]);
      await run(`UPDATE referral_rewards SET referrer_email=$2 WHERE referrer_email=$1`, [e, tag]);
      await run(`UPDATE users SET referred_by=NULL WHERE referred_by=$1`, [e]);
      await run(`DELETE FROM leads WHERE email=$1`, [e]);
      await run(
        `UPDATE performance_charges SET email=$2, restaurant_name='(deleted account)'
          WHERE email=$1 AND status='invoiced'`,
        [e, tag]
      );
      await run(`DELETE FROM performance_charges WHERE email=$1`, [e]);
      await run(`DELETE FROM subscriptions WHERE email=$1`, [e]);
      await run(`DELETE FROM users WHERE email=$1`, [e]);
    });
    return { campaigns: ids.length };
  },

  // ---- referrals + credits ----
  /** The account's referral code, created on first request. */
  async ensureReferralCode(email: string): Promise<string> {
    const row = await one(`SELECT referral_code FROM users WHERE email=$1`, [email]);
    if (row?.referral_code) return row.referral_code as string;
    const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i — read aloud safely
    for (let attempt = 0; attempt < 6; attempt++) {
      const bytes = randomUUID().replace(/-/g, "");
      let code = "";
      for (let i = 0; i < 7; i++) code += alphabet[parseInt(bytes.slice(i * 2, i * 2 + 2), 16) % alphabet.length];
      try {
        await q(`UPDATE users SET referral_code=$2 WHERE email=$1 AND referral_code IS NULL`, [email, code]);
        const check = await one(`SELECT referral_code FROM users WHERE email=$1`, [email]);
        if (check?.referral_code) return check.referral_code as string;
      } catch {
        /* unique collision — try another code */
      }
    }
    throw new Error("Could not allocate a referral code.");
  },

  async userByReferralCode(code: string): Promise<string | null> {
    const row = await one(`SELECT email FROM users WHERE referral_code=$1`, [code.toLowerCase()]);
    return (row?.email as string) ?? null;
  },

  /** Attribute a new account to its referrer — once, never to itself. */
  async setReferredBy(email: string, referrer: string): Promise<void> {
    if (email === referrer) return;
    await q(`UPDATE users SET referred_by=$2 WHERE email=$1 AND referred_by IS NULL`, [email, referrer]);
  },

  async referrerOf(email: string): Promise<string | null> {
    const row = await one(`SELECT referred_by FROM users WHERE email=$1`, [email]);
    return (row?.referred_by as string) ?? null;
  },

  async referralStats(email: string): Promise<{ signedUp: number; proven: number; earned: number }> {
    const a = await one(`SELECT COUNT(*) c FROM users WHERE referred_by=$1`, [email]);
    const b = await one(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM referral_rewards WHERE referrer_email=$1`, [email]);
    return { signedUp: num(a?.c), proven: num(b?.c), earned: num(b?.s) };
  },

  /**
   * Record a referral reward and credit both sides. Idempotent: a referred
   * restaurant can only ever trigger one reward. Returns true if this call earned it.
   */
  async rewardReferral(referred: string, referrer: string, amount: number, campaignId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const inserted = await q(
      `INSERT INTO referral_rewards (referred_email, referrer_email, amount, campaign_id, created_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (referred_email) DO NOTHING RETURNING referred_email`,
      [referred, referrer, amount, campaignId, now]
    );
    if (!inserted.length) return false;
    await this.addCredit(referrer, amount, `Referral: ${referred} proved a campaign`, `referral-referrer:${referred}`);
    await this.addCredit(referred, amount, "Welcome credit: joined through a referral", `referral-referred:${referred}`);
    return true;
  },

  async addCredit(email: string, amount: number, reason: string, ref: string): Promise<boolean> {
    const r = await q(
      `INSERT INTO credits (ref, email, amount, reason, created_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (ref) DO NOTHING RETURNING ref`,
      [ref, email, amount, reason, new Date().toISOString()]
    );
    return r.length > 0;
  },

  async creditBalance(email: string): Promise<number> {
    const r = await one(`SELECT COALESCE(SUM(amount),0) c FROM credits WHERE email=$1`, [email]);
    return num(r?.c);
  },

  /** Credit already applied to a campaign's fee (positive dollars), if any. */
  async creditApplied(email: string, campaignId: string): Promise<number> {
    const r = await one(`SELECT amount FROM credits WHERE ref=$1 AND email=$2`, [`apply:${campaignId}`, email]);
    return r ? -num(r.amount) : 0;
  },

  // ---- leads ----
  async addLead(l: Omit<Lead, "id" | "created_at">): Promise<void> {
    await q(
      `INSERT INTO leads (id, email, name, phone, restaurant, source, note, found_per_month, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [randomUUID(), l.email.toLowerCase(), l.name, l.phone, l.restaurant, l.source, l.note, l.found_per_month, new Date().toISOString()]
    );
  },

  async listLeads(limit = 200): Promise<Lead[]> {
    const rows = await q(`SELECT * FROM leads ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows.map((r) => ({
      id: r.id as string,
      email: r.email as string,
      name: (r.name as string) ?? null,
      phone: (r.phone as string) ?? null,
      restaurant: (r.restaurant as string) ?? null,
      source: r.source as string,
      note: (r.note as string) ?? null,
      found_per_month: r.found_per_month == null ? null : num(r.found_per_month),
      created_at: r.created_at as string,
    }));
  },

  // ---- pay-for-proof charges ----
  async getCharge(campaignId: string): Promise<PerformanceCharge | null> {
    const r = await one(`SELECT * FROM performance_charges WHERE campaign_id=$1`, [campaignId]);
    return r ? rowToCharge(r) : null;
  },

  async listCharges(email: string): Promise<PerformanceCharge[]> {
    const rows = await q(`SELECT * FROM performance_charges WHERE email=$1 ORDER BY created_at DESC`, [email]);
    return rows.map(rowToCharge);
  },

  /** Dollars already invoiced to this account in the current calendar month (for the cap). */
  async billedThisMonth(email: string, excludeCampaignId: string): Promise<number> {
    const month = new Date().toISOString().slice(0, 7);
    const r = await one(
      `SELECT COALESCE(SUM(amount),0) s FROM performance_charges
        WHERE email=$1 AND campaign_id<>$2 AND status IN ('invoiced','demo') AND substr(updated_at,1,7)=$3`,
      [email, excludeCampaignId, month]
    );
    return num(r?.s);
  },

  /** Insert or update a charge — but never touch one that is already invoiced. */
  async upsertCharge(c: Omit<PerformanceCharge, "created_at" | "updated_at">): Promise<PerformanceCharge> {
    const now = new Date().toISOString();
    await q(
      `INSERT INTO performance_charges
        (campaign_id, email, slug, restaurant_name, basis, rate, amount, status, stripe_invoice_id, reason, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
       ON CONFLICT (campaign_id) DO UPDATE SET
         basis=EXCLUDED.basis, rate=EXCLUDED.rate, amount=EXCLUDED.amount, status=EXCLUDED.status,
         stripe_invoice_id=EXCLUDED.stripe_invoice_id, reason=EXCLUDED.reason, updated_at=EXCLUDED.updated_at
       WHERE performance_charges.status NOT IN ('invoiced','demo','credited')`,
      [c.campaign_id, c.email, c.slug, c.restaurant_name, c.basis, c.rate, c.amount, c.status, c.stripe_invoice_id, c.reason, now]
    );
    return (await this.getCharge(c.campaign_id))!;
  },

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
      performance_rate: row.performance_rate == null ? null : num(row.performance_rate),
    };
  },

  /** Pay-for-proof accounts ever activated — the founding-100 counter. */
  async countPerformanceAccounts(): Promise<number> {
    const r = await one(`SELECT COUNT(*) c FROM subscriptions WHERE plan='performance' AND performance_rate IS NOT NULL`);
    return num(r?.c);
  },

  async upsertSubscription(sub: Subscription): Promise<void> {
    const now = new Date().toISOString();
    await q(
      `INSERT INTO subscriptions
        (email, plan, "interval", status, mode, current_period_end, stripe_customer_id, stripe_subscription_id, created_at, updated_at, performance_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10)
       ON CONFLICT(email) DO UPDATE SET
         plan=EXCLUDED.plan, "interval"=EXCLUDED."interval", status=EXCLUDED.status, mode=EXCLUDED.mode,
         current_period_end=EXCLUDED.current_period_end, stripe_customer_id=EXCLUDED.stripe_customer_id,
         stripe_subscription_id=EXCLUDED.stripe_subscription_id, updated_at=EXCLUDED.updated_at,
         -- a rate, once granted, is locked for life
         performance_rate=COALESCE(subscriptions.performance_rate, EXCLUDED.performance_rate)`,
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
        sub.performance_rate ?? null,
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
