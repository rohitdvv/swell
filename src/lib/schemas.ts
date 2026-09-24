import { z } from "zod";
import { DAYPARTS, type Daypart, type DayOfWeek } from "./types";

// ============================================================
// Request schemas for everything the browser sends the server.
// Bounded everywhere: a hostile client can't send a 200 MB "sales summary",
// a 10k-item menu, or non-hex "colours" that end up inside SVG posters.
// ============================================================

const DOWS: DayOfWeek[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const money = z.number().finite().min(-1e9).max(1e9);
const count = z.number().int().min(0).max(1e8);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const shortText = (max: number) => z.string().max(max);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const httpUrl = z
  .string()
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), "must be an http(s) URL");

const dowEntry = z.object({ net_sales: money, orders: count, avg_check: money });
const daypartEntry = z.object({ net_sales: money, orders: count });
// Every weekday / daypart key is required; unknown keys are rejected.
const dowRecord = z.record(z.enum(DOWS as [DayOfWeek, ...DayOfWeek[]]), dowEntry);
const daypartRecord = z.record(z.enum(DAYPARTS as [Daypart, ...Daypart[]]), daypartEntry);

export const SalesSummarySchema = z.object({
  restaurant_name: shortText(120),
  source: z.enum(["toast", "square", "generic"]),
  date_range: z.object({ start: isoDate, end: isoDate, days: z.number().int().min(1).max(3660) }),
  total_net_sales: money,
  guest_count: count,
  order_count: count,
  daily: z
    .array(z.object({ date: isoDate, net_sales: money, orders: count }))
    .max(800)
    .optional(),
  by_dayofweek: dowRecord,
  by_daypart: daypartRecord,
  top_items: z.array(z.object({ name: shortText(120), qty: count, net_sales: money })).max(100),
  voids: z.object({ count, amount: money }),
  payment_mix: z.object({ credit: money, cash: money, other: money }),
});

export const BrandKitSchema = z.object({
  source_url: z.string().max(2048),
  domain: shortText(255),
  name: shortText(120),
  logo_url: httpUrl.nullable(),
  image_urls: z.array(httpUrl).max(12),
  primary_color: hex,
  secondary_color: hex,
  text_on_primary: z.enum(["light", "dark"]),
  font_family: shortText(120),
  tagline: shortText(300).nullable(),
  voice_summary: shortText(120),
  voice_keywords: z.array(shortText(40)).max(20),
  voice_vector_dims: z.number().int().min(0).max(4096),
  extraction_notes: z.array(shortText(300)).max(20),
});

export const GenerateBodySchema = z.object({
  sales: SalesSummarySchema,
  brand: BrandKitSchema.optional(),
  url: shortText(2048).optional(),
  name: shortText(120).optional(),
  location: shortText(200).optional(),
  marketplace: z.enum(["demo", "neutral", "auto"]).optional(),
  startDate: isoDate.optional(),
});

export const AssistantBodySchema = z.object({
  slug: z.string().min(1).max(160),
  question: z.string().trim().min(1).max(500),
});
