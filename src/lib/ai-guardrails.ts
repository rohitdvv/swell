// ============================================================
// AI guardrails for the campaign assistant.
//
//  INPUT  — screenQuestion(): refuses prompt-injection / jailbreak attempts
//           before any model sees them.
//  OUTPUT — unsupportedNumbers(): every $ figure, % and count in an LLM
//           answer must appear in the facts the model was given. A model
//           that states a number it wasn't handed is discarded, and the
//           deterministic engine answers instead. "Never invent a number"
//           is enforced in code, not just requested in a prompt.
//
// Pure functions, no I/O — fully unit-tested.
// ============================================================

const INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override)\b[^.?!]{0,40}\b(previous|prior|above|earlier|all|your|system)\b[^.?!]{0,20}\b(instructions?|prompts?|rules?|messages?|context)\b/i,
  /\b(system|developer)\s*(prompt|message|instructions?)\b/i,
  /\b(reveal|print|show|repeat|output|leak|dump)\b[^.?!]{0,30}\b(prompt|instructions?|rules|context|hidden|secret|api[\s_-]?key|env)/i,
  /\byou\s+are\s+(now|no\s+longer)\b/i,
  /\b(act|behave|pretend|roleplay)\s+(as|like)\b[^.?!]{0,30}\b(unrestricted|jailbroken|dan|developer\s*mode|without\s+(rules|restrictions))/i,
  /\bjailbreak\b|\bdan\s+mode\b|\bdeveloper\s+mode\b/i,
  /<\|?(im_start|im_end|system|endoftext)\|?>|\[\s*\/?\s*(inst|system)\s*\]|^\s*#{2,}\s*(system|instruction)/im,
];

export type Screen = { ok: true } | { ok: false; reply: string; reason: "injection" | "empty" };

export const GUARDRAIL_REPLY =
  "I can only answer questions about this campaign — its offers, events, weather, forecast and numbers.";

export function screenQuestion(q: string): Screen {
  const text = q.normalize("NFKC").trim();
  if (!text) return { ok: false, reason: "empty", reply: "Ask me anything about this campaign." };
  if (INJECTION_PATTERNS.some((p) => p.test(text))) {
    return { ok: false, reason: "injection", reply: GUARDRAIL_REPLY };
  }
  return { ok: true };
}

/**
 * Every number worth checking in a piece of text, as values:
 *   "$3,246" → 3246   "$3.2K" → 3200   "25%" → 25   "1.4M" → 1400000
 * Bare single digits are ignored (ordinals, "a 2-step"), as are 4-digit years.
 */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(\$)?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?([kKmM])?(%)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const [, dollar, digits, suffix, pct] = m;
    let v = parseFloat(digits.replace(/,/g, ""));
    if (!Number.isFinite(v)) continue;
    if (suffix === "k" || suffix === "K") v *= 1_000;
    if (suffix === "m" || suffix === "M") v *= 1_000_000;
    const isYear = !dollar && !pct && !suffix && /^(19|20)\d{2}$/.test(digits);
    if (isYear) continue;
    if (!dollar && !pct && !suffix && v < 10) continue;
    out.push(v);
  }
  return out;
}

/**
 * Numbers in `answer` that no number in `context` supports. Tolerance covers
 * honest rounding ("$3,246" in facts may be spoken as "$3.2K"), nothing more.
 */
export function unsupportedNumbers(answer: string, context: string): number[] {
  const known = extractNumbers(context);
  return extractNumbers(answer).filter(
    (a) => !known.some((k) => Math.abs(a - k) <= Math.max(0.5, Math.abs(k) * 0.05))
  );
}
