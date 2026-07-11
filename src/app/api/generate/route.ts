import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { orchestrate, type AgentProgressEvent } from "@/lib/orchestrator";
import { repo } from "@/lib/db";
import { prewarmCreatives } from "@/lib/creative";
import { validateProjection } from "@/lib/validate";
import { getAccountEmail } from "@/lib/billing/account";
import type { ParsedSalesSummary, Campaign, CampaignDay } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type GenerateBody = {
  sales?: ParsedSalesSummary;
  brand?: Campaign["brand"];
  url?: string;
  name?: string;
  location?: string;
  marketplace?: "demo" | "neutral" | "auto";
  startDate?: string;
};

/** Persist a finished run: restaurant, campaign, and the immutable run log. */
async function persist(campaign: Campaign, days: CampaignDay[], sales: ParsedSalesSummary, startedAt: number) {
  await repo.upsertRestaurant({
    id: campaign.restaurant_id,
    slug: campaign.restaurant_slug,
    name: campaign.restaurant_name,
    website_url: campaign.brand.source_url || null,
    brand: campaign.brand,
    marketplace: campaign.marketplace,
    sales,
  });
  await repo.createCampaign(campaign, days);

  // Regenerating replaces the campaign row, so the run log is the only
  // durable record of what this generation read and projected.
  const v = validateProjection({ ...campaign, days });
  const email = await getAccountEmail();
  await repo.recordRun({
    id: randomUUID(),
    email,
    campaign_id: campaign.id,
    campaign_slug: campaign.slug,
    restaurant_name: campaign.restaurant_name,
    location: campaign.location,
    created_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    baseline_revenue: campaign.baseline_revenue,
    projected_low: v.low,
    projected_expected: v.expected,
    projected_high: v.high,
    confidence: v.confidence,
    checks_passed: v.checks.filter((c) => c.ok).length,
    checks_total: v.checks.length,
    forecast_days: campaign.context?.forecast_days ?? 0,
    seasonal_days: campaign.context?.seasonal_days ?? 0,
    event_days: campaign.context?.event_days ?? 0,
  });

  // Pre-render every poster in the background so the gallery is instant.
  void prewarmCreatives(days, campaign);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GenerateBody;
  const sales = body?.sales;
  if (!sales || !sales.by_daypart) {
    return NextResponse.json({ error: "Missing parsed sales data." }, { status: 400 });
  }

  const wantsStream = (request.headers.get("accept") || "").includes("text/event-stream");
  const startedAt = Date.now();
  const input = {
    sales,
    brand: body?.brand,
    url: body?.url,
    name: body?.name,
    location: body?.location,
    marketplace: body?.marketplace || ("auto" as const),
    startDate: body?.startDate,
  };

  // ---- plain JSON path (demo regeneration, tooling) ----
  if (!wantsStream) {
    try {
      const { campaign, days } = await orchestrate(input);
      await persist(campaign, days, sales, startedAt);
      return NextResponse.json({
        campaign: { ...campaign, days },
        slug: campaign.slug,
        trace: campaign.agent_trace,
      });
    } catch (err) {
      console.error("generate error", err);
      return NextResponse.json(
        { error: "Generation failed. " + (err instanceof Error ? err.message : "") },
        { status: 500 }
      );
    }
  }

  // ---- SSE path: the console watches every agent think in real time ----
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* client went away — orchestration continues, persistence matters */
        }
      };
      try {
        const { campaign, days } = await orchestrate({
          ...input,
          onEvent: (e: AgentProgressEvent) => send(e),
        });
        send({ type: "persisting" });
        await persist(campaign, days, sales, startedAt);
        // Send the slug only — the client fetches the campaign JSON, keeping
        // SSE frames small and the payload path identical to a page load.
        send({ type: "done", slug: campaign.slug });
      } catch (err) {
        console.error("generate stream error", err);
        send({ type: "error", message: err instanceof Error ? err.message : "Generation failed." });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
