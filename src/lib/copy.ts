import "server-only";
import { seededUnit } from "./utils";
import type { Daypart } from "./types";

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

function templateCopy(i: CopyInput): string {
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
const SYSTEM_PROMPT = `You are generating restaurant marketing copy for a 30-day promotional campaign. Inputs: restaurant brand voice, target item, target time window, discount percent. Output: a single line of marketing copy under 80 characters, matching the restaurant's voice, never claiming superiority, never using prohibited words (best, #1, guaranteed, cure, healthiest). Reject if you cannot produce on-brand copy.`;

async function llmBatch(inputs: CopyInput[]): Promise<string[] | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!anthropicKey && !groqKey) return null;

  const userPayload = inputs.map((i, idx) => ({
    n: idx,
    voice: i.voiceSummary,
    keywords: i.voiceKeywords.slice(0, 5),
    item: i.item,
    window: `${i.dow} ${i.window}`,
    pct_off: i.pctOff,
    restaurant: i.restaurantName,
  }));
  const prompt = `Generate one line of copy (<80 chars) for each of these ${inputs.length} promos. Return ONLY a JSON array of strings in order.\n${JSON.stringify(userPayload)}`;

  try {
    if (anthropicKey) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: anthropicKey });
      const msg = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
      return parseLines(text, inputs.length);
    }
    if (groqKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.8,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return parseLines(data.choices?.[0]?.message?.content ?? "", inputs.length);
    }
  } catch {
    return null;
  }
  return null;
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

export async function generateCopyBatch(inputs: CopyInput[]): Promise<CopyResult[]> {
  const llm = await llmBatch(inputs);
  return inputs.map((input, idx) => {
    if (llm && llm[idx]) {
      const candidate = llm[idx].trim().replace(/^["']|["']$/g, "");
      const check = runGuardrail(candidate);
      if (check.ok) return { copy: candidate, source: "llm", guardrail: "passed" };
      // guardrail rejected LLM output → deterministic fallback
      return {
        copy: templateCopy(input),
        source: "template",
        guardrail: `llm rejected (${check.reason}); regenerated`,
      };
    }
    return { copy: templateCopy(input), source: "template", guardrail: "passed" };
  });
}

/** Single-line regeneration (used by inline edit "regenerate copy"). */
export async function generateSingleCopy(input: CopyInput): Promise<CopyResult> {
  const [r] = await generateCopyBatch([input]);
  return r;
}
