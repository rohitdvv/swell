import "server-only";
import { seededUnit } from "./utils";
import type { Daypart, DayWeather, LocalEvent } from "./types";

export type CopyInput = {
  restaurantName: string;
  item: string;
  daypart: Daypart;
  window: string;
  pctOff: number;
  dow: string;
  voiceSummary: string;
  voiceKeywords: string[];
  seed: string;
  /** Real-world context, so the line can hook the day — not just the discount. */
  event?: LocalEvent | null;
  weather?: DayWeather | null;
};

// ---- Guardrail (free, deterministic) -----------------------
// Mirrors the spec's GPT-4o-mini guardrail: prohibited claims,
// character count, tone. Reliable and key-free.
const PROHIBITED =
  /\b(best|greatest|#1|number one|world'?s|unbeatable|cheapest|guaranteed|cure|healthiest|perfect|finest|supreme|ultimate)\b/i;
const MAX_LEN = 80;

export function runGuardrail(copy: string): { ok: boolean; reason?: string } {
  const trimmed = copy.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_LEN)
    return { ok: false, reason: `over ${MAX_LEN} chars (${trimmed.length})` };
  if (PROHIBITED.test(trimmed))
    return { ok: false, reason: "superiority / prohibited claim" };
  if (/[A-Z]{6,}/.test(trimmed.replace(/\s/g, "")))
    return { ok: false, reason: "shouting (all caps)" };
  return { ok: true };
}

// ---- Deterministic on-brand templates ----------------------
type Tpl = (i: CopyInput) => string;

const DISCOUNT_WORD = (p: number) => (p >= 30 ? "big" : p >= 20 ? "real" : "little");

const BANKS: Record<string, Tpl[]> = {
  "warm & rustic": [
    (i) => `${i.pctOff}% off ${i.item}, ${i.dow} ${winShort(i.window)}. Pull up a chair.`,
    (i) => `Slow ${i.daypart.toLowerCase()}? ${i.item} is ${i.pctOff}% off ${winShort(i.window)}.`,
    (i) => `${i.item}, made like always — ${i.pctOff}% off this ${i.daypart.toLowerCase()}.`,
    (i) => `Come hungry: ${i.pctOff}% off ${i.item}, ${winShort(i.window)} today.`,
  ],
  "refined & upscale": [
    (i) => `${i.item}, ${i.pctOff}% off — ${winShort(i.window)} only, ${i.dow}.`,
    (i) => `A quiet ${i.daypart.toLowerCase()} indulgence: ${i.item} at ${i.pctOff}% off.`,
    (i) => `Reserve the moment. ${i.item}, ${i.pctOff}% off ${winShort(i.window)}.`,
    (i) => `${i.pctOff}% off ${i.item} this ${i.daypart.toLowerCase()}. Savor it.`,
  ],
  "playful & bold": [
    (i) => `${i.item} for ${i.pctOff}% off ${winShort(i.window)}? Say less.`,
    (i) => `Beat the ${i.daypart.toLowerCase()} lull — ${i.item}, ${i.pctOff}% off. Go.`,
    (i) => `${i.pctOff}% off ${i.item}. ${i.dow}, ${winShort(i.window)}. Don't sleep.`,
    (i) => `Your ${i.daypart.toLowerCase()} just got ${i.pctOff}% better: ${i.item}.`,
  ],
  "fresh & wholesome": [
    (i) => `${i.item}, ${i.pctOff}% off ${winShort(i.window)}. Fresh, ${i.dow}.`,
    (i) => `Bright ${i.daypart.toLowerCase()} pick: ${i.item} at ${i.pctOff}% off.`,
    (i) => `${i.pctOff}% off ${i.item} — ${winShort(i.window)}, made today.`,
    (i) => `Fuel the ${i.daypart.toLowerCase()}: ${i.item}, ${i.pctOff}% off.`,
  ],
  "urban & modern": [
    (i) => `${i.item} — ${i.pctOff}% off, ${winShort(i.window)}. ${i.dow} move.`,
    (i) => `Neighborhood ${i.daypart.toLowerCase()} drop: ${i.item}, ${i.pctOff}% off.`,
    (i) => `${i.pctOff}% off ${i.item} this ${i.daypart.toLowerCase()}. Window's short.`,
    (i) => `Grab ${i.item} at ${i.pctOff}% off — ${winShort(i.window)} today.`,
  ],
  "warm & inviting": [
    (i) => `${i.pctOff}% off ${i.item}, ${i.dow} ${winShort(i.window)}. Come by.`,
    (i) => `Beat the ${i.daypart.toLowerCase()} quiet: ${i.item}, ${i.pctOff}% off.`,
    (i) => `${i.item} is ${i.pctOff}% off ${winShort(i.window)} today. See you soon.`,
    (i) => `A ${DISCOUNT_WORD(i.pctOff)} treat: ${i.item}, ${i.pctOff}% off this ${i.daypart.toLowerCase()}.`,
  ],
};

// short window like "2–5" from "2:00–5:00 PM"
function winShort(window: string): string {
  const m = window.match(/(\d{1,2})(?::\d{2})?\s*[–-]\s*(\d{1,2})(?::\d{2})?\s*(AM|PM)?/i);
  if (m) return `${m[1]}–${m[2]}${m[3] ? m[3].toLowerCase() : ""}`;
  return window;
}

/** Short, human name for the thing happening nearby. */
function eventHooks(i: CopyInput): string[] {
  const e = i.event;
  if (!e) return [];
  const short = e.name.length > 26 ? e.name.slice(0, 25).trimEnd() + "…" : e.name;
  const hooks: string[] = [];
  if (e.type === "sports") {
    hooks.push(`Game day? ${i.pctOff}% off ${i.item}, ${winShort(i.window)}.`);
    if (e.venue) hooks.push(`Heading to ${e.venue}? ${i.pctOff}% off ${i.item} first.`);
    hooks.push(`Pre-game ${i.item} — ${i.pctOff}% off, ${winShort(i.window)}.`);
  } else if (e.type === "concert") {
    hooks.push(`Show tonight? ${i.pctOff}% off ${i.item} before doors.`);
    if (e.venue) hooks.push(`Before ${e.venue}: ${i.item}, ${i.pctOff}% off.`);
    hooks.push(`${short} nearby — ${i.pctOff}% off ${i.item}.`);
  } else if (e.type === "holiday") {
    hooks.push(`${short}: ${i.pctOff}% off ${i.item}, ${winShort(i.window)}.`);
    hooks.push(`Celebrate ${short} — ${i.item}, ${i.pctOff}% off.`);
  } else {
    hooks.push(`${short} nearby — ${i.pctOff}% off ${i.item}.`);
  }
  return hooks;
}

/** Weather hook when there is no event but the day is notable. */
function weatherHooks(i: CopyInput): string[] {
  const w = i.weather;
  // A seasonal average is not a forecast — never write "Rainy Saturday?" off one.
  if (!w || w.source !== "forecast") return [];
  if (w.wet) return [`Rainy ${i.dow}? ${i.item}, ${i.pctOff}% off ${winShort(i.window)}.`];
  if (w.bucket === "cold" || w.bucket === "cool")
    return [`${w.tempF}° out — warm up with ${i.item}, ${i.pctOff}% off.`];
  if (w.bucket === "hot" || w.bucket === "warm")
    return [`${w.tempF}° and sunny — ${i.item}, ${i.pctOff}% off.`];
  return [];
}

function templateCopy(i: CopyInput): string {
  // Real-world hooks first: an event beats the weather, weather beats a plain offer.
  for (const candidate of [...eventHooks(i), ...weatherHooks(i)]) {
    const out = candidate.replace(/\s+/g, " ").trim();
    if (runGuardrail(out).ok) return out;
  }

  const bank = BANKS[i.voiceSummary] ?? BANKS["warm & inviting"];
  const order = bank
    .map((tpl, idx) => ({ tpl, r: seededUnit(i.seed + ":c" + idx) }))
    .sort((a, b) => a.r - b.r);
  for (const { tpl } of order) {
    const out = tpl(i).replace(/\s+/g, " ").trim();
    if (runGuardrail(out).ok) return out;
  }
  // guaranteed-safe fallback
  const safe = `${i.pctOff}% off ${i.item}, ${winShort(i.window)} ${i.dow}.`.slice(0, MAX_LEN);
  return safe;
}

// ---- Optional LLM providers --------------------------------
const SYSTEM_PROMPT = `You are generating restaurant marketing copy for a 30-day promotional campaign.

Each promo may include real context for that specific day:
- "event": a concert, game or holiday happening near the restaurant that day.
- "weather": the live forecast for that day.

Rules:
- Output ONE line of marketing copy, strictly under 80 characters.
- If an event is present, LEAD WITH THE EVENT as the hook, then the offer.
  e.g. "Game day at Wintrust? 25% off Margherita, 5-9pm."
- If no event but the weather is notable (rain, cold, heat), hook the weather instead.
  e.g. "Rainy Tuesday? Cacio e Pepe, 30% off."
- Otherwise hook the time window or the dish itself.
- Match the restaurant's voice. Never claim superiority. Never use: best, #1,
  guaranteed, cure, healthiest, perfect, finest, ultimate.
- Do not invent facts. Only use the event/weather/offer you are given.`;

async function llmBatch(inputs: CopyInput[]): Promise<string[] | null> {
  const { chatComplete, availableLlmProvider } = await import("./llm");
  if (!availableLlmProvider()) return null;

  const userPayload = inputs.map((i, idx) => ({
    n: idx,
    voice: i.voiceSummary,
    keywords: i.voiceKeywords.slice(0, 5),
    item: i.item,
    window: `${i.dow} ${i.window}`,
    pct_off: i.pctOff,
    restaurant: i.restaurantName,
    event: i.event
      ? {
          name: i.event.name,
          type: i.event.type,
          venue: i.event.venue ?? undefined,
        }
      : undefined,
    // Seasonal normals are withheld from the writer: they are an estimate for
    // that calendar date, not a forecast, so no caption may claim them.
    weather:
      i.weather?.source === "forecast"
        ? { condition: i.weather.condition, temp_f: i.weather.tempF, wet: i.weather.wet }
        : undefined,
  }));
  const prompt = `Generate one line of copy (<80 chars) for each of these ${inputs.length} promos. Return ONLY a JSON array of strings in order.\n${JSON.stringify(userPayload)}`;

  try {
    const result = await chatComplete({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      maxTokens: 2000,
      temperature: 0.8,
    });
    if (!result) return null;
    return parseLines(result.text, inputs.length);
  } catch {
    return null;
  }
}

function parseLines(text: string, n: number): string[] | null {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length < n) return null;
    return arr.slice(0, n).map((s) => String(s));
  } catch {
    return null;
  }
}

// ---- Public API --------------------------------------------
export type CopyResult = { copy: string; source: "llm" | "template"; guardrail: string };

/**
 * When a real event is happening that day, the line MUST hook it. Models
 * sometimes ignore that instruction and hook the weather instead, so we
 * verify rather than trust: does the copy reference the event at all?
 */
function mentionsEvent(copy: string, event: LocalEvent): boolean {
  const c = copy.toLowerCase();
  if (event.venue && c.includes(event.venue.toLowerCase().split(" ")[0])) return true;
  // Any distinctive word from the event name (skip filler like "vs", "the").
  const words = event.name
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length >= 4 && !["with", "presents", "tour", "live"].includes(w));
  if (words.some((w) => c.includes(w))) return true;
  const kind: Record<LocalEvent["type"], RegExp> = {
    sports: /\b(game|match|tip-?off|kickoff|first pitch|pre-?game)\b/,
    concert: /\b(show|gig|concert|doors|set|encore)\b/,
    holiday: /\b(holiday|celebrate|weekend)\b/,
    festival: /\b(festival|fest)\b/,
    event: /\b(event|nearby|tonight)\b/,
  };
  return kind[event.type].test(c);
}

export async function generateCopyBatch(inputs: CopyInput[]): Promise<CopyResult[]> {
  const llm = await llmBatch(inputs);
  return inputs.map((input, idx) => {
    if (llm && llm[idx]) {
      const candidate = llm[idx].trim().replace(/^["']|["']$/g, "");
      const check = runGuardrail(candidate);
      if (!check.ok) {
        return {
          copy: templateCopy(input),
          source: "template",
          guardrail: `llm rejected (${check.reason}); regenerated`,
        };
      }
      if (input.event && !mentionsEvent(candidate, input.event)) {
        return {
          copy: templateCopy(input), // event hook is first in templateCopy
          source: "template",
          guardrail: "llm ignored the local event; rewrote with the event hook",
        };
      }
      return { copy: candidate, source: "llm", guardrail: "passed" };
    }
    return { copy: templateCopy(input), source: "template", guardrail: "passed" };
  });
}

/** Single-line regeneration (used by inline edit "regenerate copy"). */
export async function generateSingleCopy(input: CopyInput): Promise<CopyResult> {
  const [r] = await generateCopyBatch([input]);
  return r;
}
