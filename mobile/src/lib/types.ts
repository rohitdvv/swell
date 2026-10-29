// The slice of the server's types the app reads. (Server: src/lib/types.ts.)
export type Daypart = "Breakfast" | "Lunch" | "Afternoon" | "Dinner" | "Late-Night";

export type CampaignDay = {
  id: string;
  date: string;
  dow: string;
  daypart: Daypart;
  discount_window: string;
  item: string;
  pct_off: number;
  copy: string;
  creative_url: string;
  projected_revenue: number;
};

export type ProofReport = {
  days_covered: number;
  lift: number;
  low80: number;
  high80: number;
  verdict: "proven" | "promising" | "too-early" | "no-lift";
};

export type Campaign = {
  id: string;
  slug: string;
  restaurant_name: string;
  month: string;
  start_date: string;
  status: "draft" | "published";
  paused: boolean;
  projected_revenue: number;
  baseline_revenue: number;
  created_at: string;
  proof?: ProofReport | null;
};

export type CampaignWithDays = Campaign & { days: CampaignDay[] };
