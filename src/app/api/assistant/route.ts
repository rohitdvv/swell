import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { askAssistant } from "@/lib/assistant";
import { AssistantBodySchema } from "@/lib/schemas";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { requireViewer } from "@/lib/authz";
import { screenQuestion, GUARDRAIL_REPLY } from "@/lib/ai-guardrails";
import { injectionScore } from "@/lib/llm";

/** Prompt Guard scores benign campaign questions ~0.0004 and attacks ~0.999. */
const INJECTION_THRESHOLD = 0.9;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    // Public endpoint that can call a paid LLM — the first line of defense
    // against someone scripting it into an open, free chatbot on our bill.
    const ip = clientIp(request);
    const burst = await rateLimit(`assistant:min:${ip}`, { limit: 12, windowMs: 60_000 });
    if (burst) return burst;
    const daily = await rateLimit(`assistant:day:${ip}`, { limit: 200, windowMs: 86_400_000 });
    if (daily) return daily;

    const parsed = AssistantBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Ask a question about this campaign." }, { status: 400 });
    }
    const { slug, question } = parsed.data;

    const campaign = await repo.getCampaignBySlug(slug);
    const denied = await requireViewer(campaign);
    if (denied) return denied;

    // Layer 1: fast deterministic screen for known injection patterns.
    const screen = screenQuestion(question);
    if (!screen.ok) {
      return NextResponse.json({ answer: screen.reply, source: "guardrail" });
    }
    // Layer 2: ML classifier (Llama Prompt Guard 2) catches paraphrased and
    // novel injections the patterns miss. Fails open — its outage never
    // blocks a real owner's question.
    const risk = await injectionScore(question);
    if (risk !== null && risk >= INJECTION_THRESHOLD) {
      return NextResponse.json({ answer: GUARDRAIL_REPLY, source: "guardrail" });
    }

    const reply = await askAssistant(question, campaign!);
    return NextResponse.json(reply);
  } catch (err) {
    console.error("assistant error", err);
    return NextResponse.json({ error: "The assistant hit a snag — try again." }, { status: 500 });
  }
}
