import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type {
  ParsedSalesSummary,
  DayOfWeek,
  Daypart,
} from "./types";
import { DAYPARTS } from "./types";

const DOW_NAMES: DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export class SalesParseError extends Error {}

type RawRow = Record<string, string>;

// ---- header mapping ----------------------------------------
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findKey(headers: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const hit = headers.find((h) => p.test(norm(h)));
    if (hit) return hit;
  }
  return null;
}

function daypartFromHour(hour: number): Daypart {
  if (hour >= 5 && hour < 11) return "Breakfast";
  if (hour >= 11 && hour < 14) return "Lunch";
  if (hour >= 14 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Dinner";
  return "Late-Night";
}

function parseNumber(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function parseHour(time: string | undefined): number | null {
  if (!time) return null;
  const t = time.trim();
  // Handle "14:30", "2:30 PM", "2:30:00 PM"
  const m = t.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h % 24;
}

function normalizeDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim().split(/[ T]/)[0];
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // M/D/YYYY or MM/DD/YY
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, mm, dd, yy] = m;
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }
  return null;
}

// ---- file → rows -------------------------------------------
export function fileToRows(buf: Buffer, filename: string): RawRow[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as RawRow[];
  }
  const text = buf.toString("utf-8");
  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return parsed.data.filter((r) => r && Object.keys(r).length > 0);
}

// ---- rows → summary ----------------------------------------
export function summarize(
  rows: RawRow[],
  fallbackName: string
): ParsedSalesSummary {
  if (!rows.length) throw new SalesParseError("The file has no rows.");
  const headers = Object.keys(rows[0]);

  const kDate = findKey(headers, [/^date$/, /businessdate/, /orderdate/, /date/, /day/]);
  const kTime = findKey(headers, [/^time$/, /ordertime/, /time/, /openedat/, /createdat/]);
  const kItem = findKey(headers, [/menuitem/, /itemname/, /^item$/, /product/, /^name$/, /item/]);
  const kQty = findKey(headers, [/quantity/, /^qty$/, /qtysold/, /count/, /units/]);
  const kNet = findKey(headers, [/netsales/, /netamount/, /netprice/, /^net$/, /amount/, /^sales$/, /total/, /gross/]);
  const kPay = findKey(headers, [/paymenttype/, /paymentmethod/, /cardtype/, /tender/, /payment/]);
  const kVoid = findKey(headers, [/voided/, /^void$/, /refunded/, /refund/]);
  const kOrder = findKey(headers, [/orderid/, /checkid/, /transactionid/, /receiptid/, /ordernumber/, /order/, /check/, /transaction/]);

  if (!kDate) throw new SalesParseError("Could not find a date column in the file.");
  if (!kNet) throw new SalesParseError("Could not find a sales / amount column.");

  const itemMap = new Map<string, { qty: number; net: number }>();
  const orderMap = new Map<
    string,
    { date: string; hour: number | null; net: number; payment: string }
  >();
  const paymentMap = new Map<string, number>();
  const dates = new Set<string>();
  let voidCount = 0;
  let voidAmount = 0;
  let rowSeq = 0;

  for (const r of rows) {
    const date = normalizeDate(r[kDate]);
    if (!date) continue;
    const net = parseNumber(r[kNet]);
    const isVoid =
      kVoid &&
      /^(y|yes|true|1|void|refunded)/i.test(String(r[kVoid] ?? "").trim());
    if (isVoid) {
      voidCount++;
      voidAmount += Math.abs(net);
      continue;
    }

    dates.add(date);
    const hour = kTime ? parseHour(r[kTime]) : null;
    const orderId = kOrder ? String(r[kOrder] || "").trim() || `row-${rowSeq++}` : `row-${rowSeq++}`;
    const payment = normalizePayment(kPay ? r[kPay] : "");

    // item stats
    if (kItem && r[kItem]) {
      const name = String(r[kItem]).trim();
      if (name) {
        const qty = kQty ? parseNumber(r[kQty]) || 1 : 1;
        const cur = itemMap.get(name) ?? { qty: 0, net: 0 };
        cur.qty += qty;
        cur.net += net;
        itemMap.set(name, cur);
      }
    }

    // order stats (accumulate line items into an order)
    const existing = orderMap.get(orderId);
    if (existing) {
      existing.net += net;
    } else {
      orderMap.set(orderId, { date, hour, net, payment });
    }
    paymentMap.set(payment, (paymentMap.get(payment) ?? 0) + net);
  }

  if (orderMap.size === 0) {
    throw new SalesParseError("No usable sales rows found after parsing.");
  }

  // date range + day count
  const sortedDates = [...dates].sort();
  const start = sortedDates[0];
  const end = sortedDates[sortedDates.length - 1];
  const spanDays =
    Math.round(
      (new Date(end).getTime() - new Date(start).getTime()) / 86400000
    ) + 1;
  const dayCount = Math.max(sortedDates.length, 1);

  if (spanDays < 14) {
    throw new SalesParseError(
      `Need at least 14 days of data — this file only spans ${spanDays} day${spanDays === 1 ? "" : "s"}.`
    );
  }

  // aggregate by dow + daypart from orders
  const byDow = emptyDow();
  const byDaypart = emptyDaypart();
  let totalNet = 0;
  for (const o of orderMap.values()) {
    totalNet += o.net;
    const dow = DOW_NAMES[new Date(o.date + "T00:00:00").getDay()];
    byDow[dow].net_sales += o.net;
    byDow[dow].orders += 1;
    const dp: Daypart = o.hour != null ? daypartFromHour(o.hour) : "Dinner";
    byDaypart[dp].net_sales += o.net;
    byDaypart[dp].orders += 1;
  }
  for (const dow of DOW_NAMES) {
    byDow[dow].avg_check =
      byDow[dow].orders > 0 ? byDow[dow].net_sales / byDow[dow].orders : 0;
  }

  const top_items = [...itemMap.entries()]
    .map(([name, v]) => ({ name, qty: Math.round(v.qty), net_sales: round2(v.net) }))
    .sort((a, b) => b.net_sales - a.net_sales)
    .slice(0, 12);

  // payment mix normalized to credit/cash/other
  const paymentTotals = { credit: 0, cash: 0, other: 0 };
  for (const [k, v] of paymentMap) {
    if (k === "credit") paymentTotals.credit += v;
    else if (k === "cash") paymentTotals.cash += v;
    else paymentTotals.other += v;
  }
  const paySum = paymentTotals.credit + paymentTotals.cash + paymentTotals.other || 1;
  const payment_mix = {
    credit: round2(paymentTotals.credit / paySum),
    cash: round2(paymentTotals.cash / paySum),
    other: round2(paymentTotals.other / paySum),
  };

  const order_count = orderMap.size;
  const guest_count = Math.round(order_count * 1.9);

  return {
    restaurant_name: fallbackName,
    source: detectSource(headers),
    date_range: { start, end, days: dayCount },
    total_net_sales: round2(totalNet),
    guest_count,
    order_count,
    by_dayofweek: byDow,
    by_daypart: byDaypart,
    top_items,
    voids: { count: voidCount, amount: round2(voidAmount) },
    payment_mix,
  };
}

export function parseSalesFile(
  buf: Buffer,
  filename: string,
  fallbackName: string
): ParsedSalesSummary {
  const rows = fileToRows(buf, filename);
  return summarize(rows, fallbackName);
}

// ---- helpers -----------------------------------------------
function normalizePayment(v: string | undefined): "credit" | "cash" | "other" {
  const s = norm(v ?? "");
  if (!s) return "other";
  if (/(credit|card|visa|master|amex|discover|chip|contactless|applepay|googlepay)/.test(s))
    return "credit";
  if (/cash/.test(s)) return "cash";
  return "other";
}

function detectSource(headers: string[]): ParsedSalesSummary["source"] {
  const joined = headers.map(norm).join(" ");
  if (/toast/.test(joined)) return "toast";
  if (/square/.test(joined)) return "square";
  return "generic";
}

function emptyDow(): ParsedSalesSummary["by_dayofweek"] {
  const o = {} as ParsedSalesSummary["by_dayofweek"];
  for (const d of DOW_NAMES) o[d] = { net_sales: 0, orders: 0, avg_check: 0 };
  return o;
}
function emptyDaypart(): ParsedSalesSummary["by_daypart"] {
  const o = {} as ParsedSalesSummary["by_daypart"];
  for (const d of DAYPARTS) o[d] = { net_sales: 0, orders: 0 };
  return o;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
