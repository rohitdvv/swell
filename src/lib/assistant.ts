import "server-only";
import type { CampaignWithDays, CampaignDay } from "./types";
import { formatCurrency, formatNumber, dowFull, formatShortDate } from "./utils";

// ============================================================
// Swell Assistant — RAG over the owner's own campaign.
//
// 1. buildFacts() flattens the campaign into retrievable fact chunks
// 2. retrieve() ranks chunks against the question (keyword overlap)
// 3. With ANTHROPIC_API_KEY / GROQ_API_KEY → LLM answers grounded in
//    the retrieved chunks. Without a key → intent-matched deterministic
//    answers computed from the same facts. Never hallucinates numbers:
//    every figure comes from the campaign row itself.
// ============================================================

export type AssistantReply = {
  answer: string;
  source: "llm" | "rules";
  suggestions: string[];
};

type Fact = { id: string; text: string; tags: string[] };

function money(n: number) {
  return formatCurrency(Math.round(n));
}

export function buildFacts(c: CampaignWithDays): Fact[] {
  const facts: Fact[] = [];
  const s = c.sales_summary;

  facts.push({
    id: "overview",
    text: `Campaign "${c.title}" for ${c.restaurant_name}, ${c.month}. Status: ${
      c.status
    }${c.paused ? " (paused — not live yet)" : " (LIVE)"}. 30 daily offers starting ${c.start_date}.`,
    tags: ["campaign", "status", "overview", "live", "active", "month", "start"],
  });
  facts.push({
    id: "revenue",
    text: `Projected incremental revenue: ${money(c.projected_revenue)} over 30 days (${(
      (c.projected_revenue / Math.max(1, c.baseline_revenue)) * 100
    ).toFixed(1)}% lift over the ${money(c.baseline_revenue)} baseline from your last ${
      s.date_range?.days ?? 30
    } days). Projected redemptions: ${formatNumber(c.projected_redemptions)}.`,
    tags: ["revenue", "money", "projected", "incremental", "lift", "redemptions", "baseline", "sales", "earn", "profit"],
  });

  if (s.by_dayofweek) {
    const dows = Object.entries(s.by_dayofweek).sort((a, b) => b[1].net_sales - a[1].net_sales);
    if (dows.length) {
      facts.push({
        id: "dow",
        text: `From your upload: best day is ${dows[0][0]} (${money(dows[0][1].net_sales)}), slowest is ${
          dows[dows.length - 1][0]
        } (${money(dows[dows.length - 1][1].net_sales)}). Average check ${money(
          s.total_net_sales / Math.max(1, s.order_count)
        )} across ${formatNumber(s.order_count)} orders.`,
        tags: ["day", "week", "best", "worst", "slow", "busy", "check", "orders", "history"],
      });
    }
  }

  if (s.top_items?.length) {
    facts.push({
      id: "items",
      text: `Your top sellers: ${s.top_items
        .slice(0, 5)
        .map((i) => `${i.name} (${money(i.net_sales)})`)
        .join(", ")}. The plan rotates featured items so no dish repeats within 3 days.`,
      tags: ["items", "menu", "dish", "sellers", "top", "featured", "food", "rotate"],
    });
  }

  const strategyText = c.strategy_notes?.join(" ") || "";
  if (strategyText) {
    facts.push({
      id: "strategy",
      text: `Strategy: ${strategyText}`,
      tags: ["strategy", "why", "discount", "percent", "off", "logic", "brain", "how", "decided", "marketplace", "demand"],
    });
  }

  if (c.context?.located) {
    facts.push({
      id: "weather",
      text: `Live conditions for ${c.context.location_label}: a ${c.context.forecast_days}-day live forecast${
        c.context.seasonal_days
          ? `, plus ${c.context.seasonal_days} later day(s) covered by seasonal climate normals (the average weather for that calendar date over the past 5 years — an estimate, not a forecast, because forecasts only reach about 16 days out)`
          : ""
      }. Average ${c.context.avg_temp_f}°F, ${c.context.rain_days} wet day(s), ${c.context.event_days} local event day(s). Rainy/cold days get comfort dishes at deeper discounts; warm days get lighter items at protected margins. Events shift the plan toward hero items with smaller discounts (demand is already coming).`,
      tags: ["weather", "rain", "forecast", "temperature", "events", "local", "conditions", "cold", "hot", "adapt", "seasonal", "normal", "estimate"],
    });
  }

  for (const d of c.days) {
    const bits = [
      `${dowFull(d.date)} ${formatShortDate(d.date)}: ${d.pct_off}% off ${d.item} during ${d.daypart} (${d.discount_window}).`,
      `Projected ${formatNumber(d.projected_redemptions)} redemptions, ${money(d.projected_revenue)} incremental.`,
      d.weather ? `Weather: ${d.weather.condition}, ${d.weather.tempF}°F.` : "",
      d.event ? `Local event: ${d.event.name}.` : "",
      d.context_note ? `Note: ${d.context_note}.` : "",
      d.rationale ? `Why: ${d.rationale}.` : "",
    ].filter(Boolean);
    facts.push({
      id: `day-${d.day_index}`,
      text: bits.join(" "),
      tags: [
        dowFull(d.date).toLowerCase(),
        d.date,
        formatShortDate(d.date).toLowerCase(),
        d.item.toLowerCase(),
        d.daypart.toLowerCase(),
        "day",
        String(d.day_index + 1),
      ],
    });
  }

  facts.push({
    id: "howto",
    text: `How to use Swell: "Activate campaign" sets the plan live. Click any day (calendar or poster) to edit its item, discount, window or copy — projections recompute instantly. The Posters tab has a downloadable branded poster for every day. The Report tab shows last-30-days vs projected charts. The Distribution tab packages Meta/Google-ready ad assets; connecting ad accounts requires the owner's own Meta/Google credentials.`,
    tags: ["how", "activate", "edit", "change", "poster", "download", "report", "distribution", "connect", "ads", "publish", "help", "use"],
  });

  if (c.marketplace) {
    facts.push({
      id: "marketplace",
      text: `Marketplace signal${c.marketplace.simulated ? " (SIMULATED — modeled preview, not real app data yet)" : ""}: organic demand ${Math.round((c.marketplace.organic_demand_index || 0) * 100)}/100, demand lift ×${c.marketplace.lift_factor?.toFixed(2)}. ${c.marketplace.notes?.join(" ") || ""}`,
      tags: ["marketplace", "demand", "saves", "simulated", "organic", "signal", "lift"],
    });
  }

  return facts;
}

export function retrieve(
  question: string,
  facts: Fact[],
  k = 6
): { chunks: Fact[]; maxScore: number } {
  const words = (question.toLowerCase().match(/[a-z0-9%']+/g) || []).filter((w) => w.length > 2);
  const scored = facts.map((f) => {
    const hay = (f.text + " " + f.tags.join(" ")).toLowerCase();
    let score = 0;
    for (const w of words) {
      if (f.tags.some((t) => t === w)) score += 3;
      else if (hay.includes(w)) score += 1;
    }
    return { f, score };
  });
  const hits = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
  const maxScore = hits[0]?.score ?? 0;
  // Always ground with overview + revenue even on weak matches.
  const base = facts.filter((f) => f.id === "overview" || f.id === "revenue");
  const merged = [...new Map([...hits.map((h) => h.f), ...base].map((f) => [f.id, f])).values()];
  return { chunks: merged.slice(0, k + 2), maxScore };
}

// ---- deterministic (keyless) answers -----------------------
const CAPABILITIES =
  "I can only answer from this campaign's data. Try asking about:\n• projected revenue & redemptions\n• why a day has its discount / item\n• a specific day (\"what's the offer Friday?\")\n• how weather & local events change the plan\n• how to activate, edit a day, or download posters";

function rulesAnswer(
  question: string,
  c: CampaignWithDays,
  facts: Fact[],
  maxScore: number
): string {
  const q = question.toLowerCase().trim();
  const find = (id: string) => facts.find((f) => f.id === id)?.text || "";

  // greetings / small talk — don't dump facts at "hi"
  if (/^(hi|hello|hey|yo|thanks|thank you|ok|okay|cool)\b/.test(q) && q.length < 25) {
    return `Hi! I'm the Swell assistant for ${c.restaurant_name}. ${CAPABILITIES}`;
  }

  // day-specific question? (match day-of-week, date, or a distinctive item word)
  const dayHit = c.days.find(
    (d) =>
      q.includes(dowFull(d.date).toLowerCase()) ||
      q.includes(formatShortDate(d.date).toLowerCase()) ||
      d.item
        .toLowerCase()
        .split(" ")
        .some((w) => w.length >= 4 && q.includes(w))
  );

  if (/why.*(discount|%|percent|off)|how.*(discount|decided|chose|pick)/.test(q))
    return `${find("strategy")}\n\n${
      find("weather") || "Add a location when generating to enable weather/event adaptation."
    }`;
  if (dayHit && /(what|why|when|how|off|deal|offer|special)/.test(q)) {
    return facts.find((f) => f.id === `day-${(dayHit as CampaignDay).day_index}`)?.text || find("overview");
  }
  if (/revenue|money|earn|profit|lift|project|sales/.test(q)) return find("revenue");
  if (/weather|rain|event|forecast|temperature|game|concert|holiday/.test(q))
    return (
      find("weather") ||
      "This campaign has no location set, so live weather/event adaptation is off. Regenerate with a location to enable it."
    );
  if (/item|dish|menu|seller|food/.test(q)) return find("items");
  if (/activate|live|start|publish|edit|change|poster|download|connect|ads|meta|google/.test(q))
    return find("howto");
  if (/simulated|marketplace|saves|demand/.test(q)) return find("marketplace");
  if (/best|slow|busy|day of week|weekday|check/.test(q)) return find("dow");

  // Honest fallback: if retrieval is weak, say so — never stitch random facts.
  if (maxScore < 3) {
    return `I don't have an answer for that in this campaign's data. ${CAPABILITIES}`;
  }
  // Strong single match → return just the best fact, clearly framed.
  const { chunks } = retrieve(question, facts, 1);
  const best = chunks.find((f) => f.id !== "overview" && f.id !== "revenue") ?? chunks[0];
  return `Here's what this campaign's data says:\n\n${best.text}`;
}

// ---- optional LLM (real RAG generation) ---------------------
const SYSTEM = `You are Swell's assistant, helping a restaurant owner understand their 30-day campaign. Answer ONLY from the provided campaign facts — never invent numbers. Be concise (2-5 sentences), warm, plain-spoken, no jargon. If the facts don't cover it, say so and suggest what to check in the dashboard.`;

async function llmAnswer(question: string, chunks: Fact[]): Promise<string | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!anthropicKey && !groqKey) return null;
  const context = chunks.map((f) => `- ${f.text}`).join("\n");
  const user = `Campaign facts:\n${context}\n\nOwner's question: ${question}`;
  try {
    if (anthropicKey) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: anthropicKey });
      const msg = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      });
      return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || null;
    }
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

const SUGGESTIONS = [
  "How much extra revenue will this make?",
  "Why these discount percentages?",
  "How does weather change the plan?",
  "What's the offer this Friday?",
  "How do I edit a day?",
  "How do I put this on Meta or Google ads?",
];

export async function askAssistant(
  question: string,
  campaign: CampaignWithDays
): Promise<AssistantReply> {
  const facts = buildFacts(campaign);
  const { chunks, maxScore } = retrieve(question, facts);
  const llm = await llmAnswer(question, chunks);
  if (llm) return { answer: llm, source: "llm", suggestions: SUGGESTIONS };
  return {
    answer: rulesAnswer(question, campaign, facts, maxScore),
    source: "rules",
    suggestions: SUGGESTIONS,
  };
}
