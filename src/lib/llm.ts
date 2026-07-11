import "server-only";

/**
 * Unified chat LLM client for Swell.
 *
 * Priority (first key present wins):
 *   1. XAI_API_KEY      → Grok via SpaceXAI / xAI (OpenAI-compatible)
 *   2. ANTHROPIC_API_KEY → Claude Sonnet
 *   3. GROQ_API_KEY      → free Llama 3.3 70B
 *
 * Returns null when no key is set — callers fall back to deterministic rules.
 * Never invents keys; never throws for missing credentials.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResult = {
  text: string;
  provider: "xai" | "anthropic" | "groq";
  model: string;
};

export function availableLlmProvider(): ChatResult["provider"] | null {
  if (process.env.XAI_API_KEY) return "xai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  return null;
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
    try {
      const model = process.env.XAI_MODEL || "grok-4.5";
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${xai}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            ...rest,
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return { text, provider: "xai", model };
      }
    } catch {
      /* fall through */
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: anthropicKey });
      const model = "claude-sonnet-4-20250514";
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
      if (text) return { text, provider: "anthropic", model };
    } catch {
      /* fall through */
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const model = "llama-3.3-70b-versatile";
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            ...rest,
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return { text, provider: "groq", model };
      }
    } catch {
      /* fall through */
    }
  }

  return null;
}
