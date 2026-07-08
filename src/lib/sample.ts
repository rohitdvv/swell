import { toISODate } from "./utils";

// ------------------------------------------------------------
// Deterministic sample restaurant + realistic transaction CSV.
// This produces a genuine transaction-level export that the real
// parser (csv.ts) consumes — so the demo exercises the full path.
// ------------------------------------------------------------

export const SAMPLE_RESTAURANT = "Osteria Lume";
export const SAMPLE_WEBSITE = "https://osterialume.example";

type MenuItem = {
  name: string;
  price: number;
  pop: number; // relative popularity weight
  // affinity per daypart (Breakfast, Lunch, Afternoon, Dinner, Late-Night)
  aff: [number, number, number, number, number];
};

const MENU: MenuItem[] = [
  { name: "Cacio e Pepe", price: 24, pop: 10, aff: [0, 6, 3, 10, 5] },
  { name: "Bucatini all'Amatriciana", price: 26, pop: 8, aff: [0, 5, 2, 10, 4] },
  { name: "Margherita Pizza", price: 19, pop: 12, aff: [0, 8, 5, 9, 7] },
  { name: "Tagliatelle al Ragù", price: 28, pop: 7, aff: [0, 4, 2, 10, 3] },
  { name: "Burrata & Heirloom", price: 18, pop: 9, aff: [0, 7, 6, 8, 4] },
  { name: "Branzino", price: 34, pop: 4, aff: [0, 2, 1, 9, 2] },
  { name: "Caesar Lume", price: 16, pop: 8, aff: [0, 9, 6, 6, 3] },
  { name: "Arancini", price: 14, pop: 7, aff: [0, 6, 8, 6, 8] },
  { name: "Tiramisù", price: 12, pop: 9, aff: [0, 4, 5, 8, 9] },
  { name: "Negroni", price: 16, pop: 11, aff: [0, 3, 7, 8, 12] },
  { name: "Aperol Spritz", price: 15, pop: 10, aff: [0, 4, 10, 7, 9] },
  { name: "Espresso", price: 5, pop: 6, aff: [0, 5, 9, 6, 6] },
  { name: "House Chianti (glass)", price: 14, pop: 9, aff: [0, 4, 6, 9, 8] },
  { name: "Focaccia", price: 9, pop: 8, aff: [0, 7, 7, 7, 6] },
];

// Daypart hour bounds
const DAYPART_HOURS: Array<[number, number]> = [
  [7, 10], // Breakfast (unused for this venue)
  [11, 13], // Lunch
  [14, 16], // Afternoon
  [17, 20], // Dinner
  [21, 24], // Late-Night
];

// Base volume weight by daypart — dinner-dominant trattoria.
const DAYPART_VOLUME = [0, 0.22, 0.09, 0.55, 0.14];

// Orders per day by day-of-week (Sun..Sat). Weekends spike.
const DOW_ORDERS = [95, 62, 68, 74, 88, 130, 142];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export type SampleMeta = {
  restaurant_name: string;
  website: string;
  days: number;
  start: string;
  end: string;
};

/** Build a deterministic transaction-level CSV (Square/Toast-style). */
export function buildSampleCsv(days = 45): { csv: string; meta: SampleMeta } {
  const rand = mulberry32(60_2026);
  const rows: string[] = [
    "Date,Time,Order Id,Item,Qty,Net Sales,Payment Type,Voided",
  ];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - days);

  let orderId = 48210;
  for (let d = 0; d < days; d++) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);
    const iso = toISODate(date);
    const dow = date.getDay();
    const baseOrders = DOW_ORDERS[dow];
    const nOrders = Math.round(baseOrders * (0.85 + rand() * 0.3));

    for (let o = 0; o < nOrders; o++) {
      orderId++;
      // choose daypart weighted by venue volume profile
      const daypart = pickIndex(rand, DAYPART_VOLUME);
      const [h0, h1] = DAYPART_HOURS[daypart];
      const hour = h0 + Math.floor(rand() * Math.max(1, h1 - h0));
      const minute = Math.floor(rand() * 60);
      const time = `${String(hour % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

      const nItems = 1 + (rand() < 0.55 ? 1 : 0) + (rand() < 0.28 ? 1 : 0);
      const payment = pick(rand, ["Credit", "Cash", "Other"], [78, 12, 10]);
      const voided = rand() < 0.012 ? "Yes" : "No";

      for (let it = 0; it < nItems; it++) {
        const weights = MENU.map((m) => m.pop * (m.aff[daypart] + 0.5));
        const item = pick(rand, MENU, weights);
        const qty = 1 + (rand() < 0.12 ? 1 : 0);
        const net = (item.price * qty).toFixed(2);
        rows.push(
          `${iso},${time},${orderId},${escapeCsv(item.name)},${qty},${net},${payment},${voided}`
        );
      }
    }
  }

  const end = new Date(today);
  end.setDate(end.getDate() - 1);
  return {
    csv: rows.join("\n"),
    meta: {
      restaurant_name: SAMPLE_RESTAURANT,
      website: SAMPLE_WEBSITE,
      days,
      start: toISODate(start),
      end: toISODate(end),
    },
  };
}

function pickIndex(rand: () => number, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function escapeCsv(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
