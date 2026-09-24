import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { orchestrate, type AgentProgressEvent } from "@/lib/orchestrator";
import { repo } from "@/lib/db";
import { prewarmCreatives } from "@/lib/creative";
import { validateProjection } from "@/lib/validate";
import { getAccountEmail } from "@/lib/billing/account";
import { GenerateBodySchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { toPublic } from "@/lib/authz";
import type { ParsedSalesSummary, Campaign, CampaignDay } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Stamp the owner, and keep slugs tenant-safe: if another account already
 * owns this restaurant-month slug, this run gets a short unique suffix
 * instead of replacing their campaign.
 */
async function claimSlug(campaign: Campaign, owner: string): Promise<void> {
  campaign.owner_email = owner;
  const existing = await repo.slugOwner(campaign.slug);
  if (existing === undefined || existing === owner) return;
  campaign.slug = `${campaign.slug}-${randomUUID().slice(0, 6)}`;
}

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
  // Defense in depth: the proxy already requires sign-in for this route.
  const owner = await getAccountEmail();
  if (!owner) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  // Each run is ~10 agents + LLM calls + 30 poster renders — cap per account.
  const limited = await rateLimit(`generate:${owner}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const parsed = GenerateBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That sales file didn't look right — try re-uploading it." },
      { status: 400 }
    );
  }
  const body = parsed.data;
  const sales = body.sales as ParsedSalesSummary;

  const wantsStream = (request.headers.get("accept") || "").includes("text/event-stream");
  const startedAt = Date.now();
  const input = {
    sales,
    brand: body.brand,
    url: body.url,
    name: body.name,
    location: body.location,
    marketplace: body.marketplace || ("auto" as const),
    startDate: body.startDate,
  };

  // ---- plain JSON path (tooling) ----
  if (!wantsStream) {
    try {
      const { campaign, days } = await orchestrate(input);
      await claimSlug(campaign, owner);
      await persist(campaign, days, sales, startedAt);
      return NextResponse.json({
        campaign: toPublic({ ...campaign, days }),
        slug: campaign.slug,
        trace: campaign.agent_trace,
      });
    } catch (err) {
      // Log the detail server-side; never ship internals to the browser.
      console.error("generate error", err);
      return NextResponse.json({ error: "Generation failed — please try again." }, { status: 500 });
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
        await claimSlug(campaign, owner);
        await persist(campaign, days, sales, startedAt);
        // Send the slug only — the client fetches the campaign JSON, keeping
        // SSE frames small and the payload path identical to a page load.
        send({ type: "done", slug: campaign.slug });
      } catch (err) {
        console.error("generate stream error", err);
        send({ type: "error", message: "Generation failed — please try again." });
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
