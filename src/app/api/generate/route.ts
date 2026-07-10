import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { orchestrate } from "@/lib/orchestrator";
import { repo } from "@/lib/db";
import { prewarmCreatives } from "@/lib/creative";
import { validateProjection } from "@/lib/validate";
import { getAccountEmail } from "@/lib/billing/account";
import type { ParsedSalesSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sales = body?.sales as ParsedSalesSummary | undefined;
    if (!sales || !sales.by_daypart) {
      return NextResponse.json({ error: "Missing parsed sales data." }, { status: 400 });
    }

    const startedAt = Date.now();
    const { campaign, days } = await orchestrate({
      sales,
      brand: body?.brand,
      url: body?.url,
      name: body?.name,
      location: body?.location,
      marketplace: body?.marketplace || "auto",
      startDate: body?.startDate,
    });

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
