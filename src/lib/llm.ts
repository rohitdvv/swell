import "server-only";

/**
 * Unified chat LLM client for Swell.
 *
 * Provider priority (first configured key wins, then falls through on error):
 *   1. XAI_API_KEY        → Grok (OpenAI-compatible)
 *   2. ANTHROPIC_API_KEY  → Claude
 *   3. GROQ_API_KEY       → open-weight models on Groq, with a model fallback chain
 *
 * Production rules this file enforces, learned the hard way:
 *   - Model ids are configurable, and Groq has a fallback CHAIN. A retired
 *     model (Groq retired llama-3.3-70b-versatile) must degrade to the next
 *     model, not silently to "no LLM at all".
 *   - Every failure is LOGGED with provider, model and status. The previous
 *     client swallowed errors, so a dead model went unnoticed for weeks.
 *   - Every call has a timeout, so a hung provider can't hold a request open.
 *
 * Returns null only when no provider produced text — callers then use their
 * deterministic fallbacks.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResult = {
  text: string;
  provider: "xai" | "anthropic" | "groq";
  model: string;
};

const TIMEOUT_MS = 20_000;

/** Live provider health, surfaced by /api/health. Process-local by design. */
export const llmHealth: Record<string, { ok: boolean; model: string; at: string; detail?: string }> = {};

function record(provider: string, model: string, ok: boolean, detail?: string) {
  llmHealth[provider] = { ok, model, at: new Date().toISOString(), detail };
  if (!ok) console.error(`[llm] ${provider}/${model} failed: ${detail}`);
}

export function availableLlmProvider(): ChatResult["provider"] | null {
  if (process.env.XAI_API_KEY) return "xai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  return null;
}

/** Groq's model chain. GROQ_MODEL (if set) is tried first. */
function groqModels(): string[] {
  const chain = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
  const pinned = process.env.GROQ_MODEL;
  return pinned ? [pinned, ...chain.filter((m) => m !== pinned)] : chain;
}

async function openAiCompatible(opts: {
  provider: ChatResult["provider"];
  url: string;
  key: string;
  model: string;
  system: string;
  rest: ChatMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<{ text: string | null; status: number }> {
  // gpt-oss models reason before answering, and reasoning tokens count
  // against max_tokens — with a small budget they return an EMPTY answer.
  // Keep reasoning light and hidden, and give headroom for it.
  const isReasoning = opts.model.startsWith("openai/gpt-oss");
  const res = await fetch(opts.url, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "content-type": "application/json", authorization: `Bearer ${opts.key}` },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature,
      max_tokens: isReasoning ? opts.maxTokens + 1024 : opts.maxTokens,
      ...(isReasoning ? { reasoning_effort: "low", reasoning_format: "hidden" } : {}),
      messages: [...(opts.system ? [{ role: "system", content: opts.system }] : []), ...opts.rest],
    }),
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    record(opts.provider, opts.model, false, `HTTP ${res.status} ${body}`);
    return { text: null, status: res.status };
  }
  const data = await res.json();
  const text: string | undefined = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    record(opts.provider, opts.model, false, "empty completion");
    return { text: null, status: res.status };
  }
  record(opts.provider, opts.model, true);
  return { text, status: res.status };
}

export async function chatComplete(opts: {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatResult | null> {
  const maxTokens = opts.maxTokens ?? 800;
  const temperature = opts.temperature ?? 0.6;
  const system = opts.messages.find((m) => m.role === "system")?.content ?? "";
  const rest = opts.messages.filter((m) => m.role !== "system");

  const xai = process.env.XAI_API_KEY;
  if (xai) {
    const model = process.env.XAI_MODEL || "grok-4.5";
    try {
      const r = await openAiCompatible({
        provider: "xai",
        url: "https://api.x.ai/v1/chat/completions",
        key: xai,
        model,
        system,
        rest,
        maxTokens,
        temperature,
      });
      if (r.text) return { text: r.text, provider: "xai", model };
    } catch (err) {
      record("xai", model, false, err instanceof Error ? err.message : String(err));
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: anthropicKey, timeout: TIMEOUT_MS, maxRetries: 1 });
      const msg = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: system || undefined,
        messages: rest.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      });
      const text = msg.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      if (text) {
        record("anthropic", model, true);
        return { text, provider: "anthropic", model };
      }
      record("anthropic", model, false, "empty completion");
    } catch (err) {
      record("anthropic", model, false, err instanceof Error ? err.message : String(err));
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    for (const model of groqModels()) {
      try {
        const r = await openAiCompatible({
          provider: "groq",
          url: "https://api.groq.com/openai/v1/chat/completions",
          key: groqKey,
          model,
          system,
          rest,
          maxTokens,
          temperature,
        });
        if (r.text) return { text: r.text, provider: "groq", model };
        // A missing/retired model or overload: try the next model in the chain.
        // Auth errors won't be fixed by another model — stop there.
        if (r.status === 401 || r.status === 403) break;
      } catch (err) {
        record("groq", model, false, err instanceof Error ? err.message : String(err));
      }
    }
  }

  return null;
}

/**
 * ML prompt-injection classifier (Llama Prompt Guard 2, hosted on Groq) —
 * the second guardrail layer behind the regex screen. Returns the model's
 * injection probability in [0,1], or null when unavailable (callers then rely
 * on the regex layer alone; this layer never blocks on its own failure).
 */
export async function injectionScore(text: string): Promise<number | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const model = "meta-llama/llama-prompt-guard-2-86m";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(4_000),
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: text.slice(0, 2000) }] }),
    });
    if (!res.ok) {
      record("prompt-guard", model, false, `HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const raw = String(data.choices?.[0]?.message?.content ?? "").trim();
    const score = parseFloat(raw);
    if (!Number.isFinite(score)) {
      record("prompt-guard", model, false, `unparseable: ${raw.slice(0, 40)}`);
      return null;
    }
    record("prompt-guard", model, true);
    return Math.max(0, Math.min(1, score));
  } catch (err) {
    record("prompt-guard", model, false, err instanceof Error ? err.message : String(err));
    return null;
  }
}
