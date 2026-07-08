import { NextResponse } from "next/server";
import { orchestrate } from "@/lib/orchestrator";
import { repo } from "@/lib/db";
import { prewarmCreatives } from "@/lib/creative";
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

    const { campaign, days } = await orchestrate({
      sales,
      brand: body?.brand,
      url: body?.url,
      name: body?.name,
      location: body?.location,
      marketplace: body?.marketplace || "auto",
      startDate: body?.startDate,
    });

    repo.upsertRestaurant({
      id: campaign.restaurant_id,
      slug: campaign.restaurant_slug,
      name: campaign.restaurant_name,
      website_url: campaign.brand.source_url || null,
      brand: campaign.brand,
      marketplace: campaign.marketplace,
      sales,
    });
    repo.createCampaign(campaign, days);

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
