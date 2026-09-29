// ============================================================
// Swell — Domain contracts
// ============================================================

export type DayOfWeek =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

export type Daypart =
  | "Breakfast"
  | "Lunch"
  | "Afternoon"
  | "Dinner"
  | "Late-Night";

export const DAYPARTS: Daypart[] = [
  "Breakfast",
  "Lunch",
  "Afternoon",
  "Dinner",
  "Late-Night",
];

export const DAYPART_WINDOWS: Record<Daypart, string> = {
  Breakfast: "7:00–10:30 AM",
  Lunch: "11:00 AM–2:00 PM",
  Afternoon: "2:00–5:00 PM",
  Dinner: "5:00–9:00 PM",
  "Late-Night": "9:00 PM–1:00 AM",
};

// ---- Input A: Parsed sales ----------------------------------
/** One real day of history — the series the forecasting model trains on. */
export type DailySales = {
  date: string; // YYYY-MM-DD
  net_sales: number;
  orders: number;
};

export type ParsedSalesSummary = {
  restaurant_name: string;
  source: "toast" | "square" | "generic";
  date_range: { start: string; end: string; days: number };
  total_net_sales: number;
  guest_count: number;
  order_count: number;
  /** Per-day revenue series (optional: absent on campaigns parsed before this existed). */
  daily?: DailySales[];
  by_dayofweek: Record<
    DayOfWeek,
    { net_sales: number; orders: number; avg_check: number }
  >;
  by_daypart: Record<Daypart, { net_sales: number; orders: number }>;
  top_items: Array<{ name: string; qty: number; net_sales: number }>;
  voids: { count: number; amount: number };
  payment_mix: Record<"credit" | "cash" | "other", number>;
};

// ---- Input B: Brand kit -------------------------------------
export type BrandKit = {
  source_url: string;
  domain: string;
  name: string;
  logo_url: string | null;
  image_urls: string[]; // scraped hero / gallery imagery for poster backgrounds
  primary_color: string; // hex
  secondary_color: string; // hex
  text_on_primary: "light" | "dark";
  font_family: string;
  tagline: string | null;
  voice_summary: string; // short human description of tone
  voice_keywords: string[];
  voice_vector_dims: number; // embedding dimension (for the record)
  extraction_notes: string[];
};

// ---- Input C: Marketplace signals ---------------------------
export type MarketplaceSignals = {
  in_marketplace: boolean;
  simulated: boolean; // true = modeled preview, NOT real consumer-app data
  saves: number;
  favorites: number;
  past_redemptions: number;
  organic_demand_index: number; // 0..1, higher = more organic pull
  neighborhood: {
    radius_miles: number;
    dominant_age_band: string;
    median_basket: number;
    consumer_density: "low" | "moderate" | "high";
  };
  lift_factor: number; // multiplier on historical orders
  notes: string[];
};

// ---- Auth ----------------------------------------------------
export type User = {
  email: string;
  name: string;
  restaurant_name: string | null;
  created_at: string;
};

// ---- Billing / subscriptions --------------------------------
export type Subscription = {
  email: string;
  plan: "starter" | "pro" | "agency" | "performance";
  interval: "monthly" | "annual";
  status: "active" | "trialing" | "past_due" | "canceled";
  mode: "live" | "demo";
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

// ---- Real-time context (weather / events / location) --------
export type DayWeather = {
  tempF: number;
  lowF: number;
  code: number;
  condition: string;
  icon: string;
  rainProb: number;
  bucket: "cold" | "cool" | "mild" | "warm" | "hot";
  wet: boolean;
  /**
   * "forecast" = the live 16-day forecast.
   * "seasonal" = a climate normal (average of this calendar date over the
   * last 5 years) for days beyond the forecast horizon. Never presented as
   * a forecast.
   */
  source: "forecast" | "seasonal";
};

export type LocalEvent = {
  name: string;
  type: "holiday" | "concert" | "sports" | "festival" | "event";
  demand: "up" | "neutral";
  venue?: string | null; // e.g. "Wintrust Arena" — used to write the hook
};

export type ContextSummary = {
  located: boolean;
  location_label: string | null;
  forecast_days: number; // days covered by the live forecast
  seasonal_days: number; // days covered by climate normals instead
  rain_days: number;
  warm_days: number;
  cold_days: number;
  event_days: number;
  avg_temp_f: number | null;
};

// ---- Multi-agent orchestration trace ------------------------
export type AgentName =
  | "Brand Agent"
  | "Demand Agent"
  | "Location Agent"
  | "Weather Agent"
  | "Events Agent"
  | "Analyst Agent"
  | "Strategy Agent"
  | "Copywriter Agent"
  | "Creative Agent"
  | "Revenue Agent";

export type AgentEvent = {
  agent: AgentName;
  role: string;
  detail: string;
  ms: number;
};

// ---- Output: Campaign ---------------------------------------
export type CampaignDay = {
  id: string;
  campaign_id: string;
  day_index: number; // 0..29
  date: string; // YYYY-MM-DD
  dow: DayOfWeek;
  daypart: Daypart;
  discount_window: string; // human window e.g. "2:00–5:00 PM"
  item: string;
  pct_off: number;
  projected_redemptions: number;
  projected_revenue: number;
  copy: string;
  creative_url: string;
  rationale: string; // why the brain chose this
  weather: DayWeather | null; // live forecast for this date
  event: LocalEvent | null; // holiday / nearby event on this date
  context_note: string | null; // how weather/events shaped this day
  expected_covers: number; // prep / inventory hint
  edited: boolean;
};

export type Campaign = {
  id: string;
  /** Clerk email of the account that generated it. null = system-owned (the
   * public demo) — nobody can mutate a system-owned campaign. */
  owner_email: string | null;
  restaurant_id: string;
  slug: string; // full public slug [restaurant-slug]-[month]
  restaurant_slug: string;
  restaurant_name: string;
  month: string; // e.g. "August 2026"
  start_date: string;
  title: string;
  status: "draft" | "published";
  paused: boolean;
  projected_revenue: number;
  projected_redemptions: number;
  baseline_revenue: number;
  brand: BrandKit;
  marketplace: MarketplaceSignals;
  sales_summary: ParsedSalesSummary;
  strategy_notes: string[];
  agent_trace: AgentEvent[];
  location: string | null; // operator-entered location string
  context: ContextSummary | null; // live weather/events summary
  created_at: string;
  published_at: string | null;
  /** Measured lift after the campaign ran (Proof). null until the owner uploads results. */
  proof?: import("./proof").ProofReport | null;
};

/**
 * One generation of a campaign. Regenerating replaces the campaign (its public
 * URL must stay stable), so this is the only durable record that a run
 * happened, what it read, and what it projected at the time.
 */
export type CampaignRun = {
  id: string;
  email: string | null;
  campaign_id: string;
  campaign_slug: string;
  restaurant_name: string;
  location: string | null;
  created_at: string;
  duration_ms: number;
  baseline_revenue: number;
  projected_low: number;
  projected_expected: number;
  projected_high: number;
  confidence: "low" | "moderate" | "high";
  checks_passed: number;
  checks_total: number;
  forecast_days: number;
  seasonal_days: number;
  event_days: number;
};

export type CampaignRecord = Omit<Campaign, "days"> & { days?: CampaignDay[] };
export type CampaignWithDays = Campaign & { days: CampaignDay[] };
