import { NextResponse } from "next/server";
import { generateCampaign } from "@/lib/generator";
import { extractBrandKit, neutralBrandKit } from "@/lib/brand";
import {
  synthesizeMarketplaceSignals,
  neutralSignals,
} from "@/lib/marketplace";
import { repo } from "@/lib/db";
import { slugify } from "@/lib/utils";
import type { ParsedSalesSummary, BrandKit } from "@/lib/types";

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

    const name: string =
      (body?.name || "").trim() || sales.restaurant_name || "Your Restaurant";

    // Brand kit: use provided, else extract from url, else neutral.
    let brand: BrandKit | undefined = body?.brand;
    if (!brand) {
      const url: string = (body?.url || "").trim();
      brand = url ? await extractBrandKit(url) : neutralBrandKit(name);
    }
    if (brand && !brand.name) brand.name = name;

    const slug = slugify(brand.name || name);
    const avgBasket =
      sales.order_count > 0 ? Math.round(sales.total_net_sales / sales.order_count) : 42;

    // Marketplace signals.
    const mode: "demo" | "neutral" | "auto" = body?.marketplace || "auto";
    let signals;
    if (mode === "neutral") {
      signals = neutralSignals(avgBasket);
    } else if (mode === "demo") {
      signals = synthesizeMarketplaceSignals(slug, avgBasket);
      repo.putMarketplaceSignal(slug, signals);
    } else {
      const mirror = repo.getMarketplaceSignal(slug);
      signals = mirror ?? neutralSignals(avgBasket);
    }

    const { campaign, days } = await generateCampaign(sales, brand, signals, {
      startDate: body?.startDate,
    });

    repo.upsertRestaurant({
      id: campaign.restaurant_id,
      slug: campaign.restaurant_slug,
      name: campaign.restaurant_name,
      website_url: brand.source_url || null,
      brand,
      marketplace: signals,
      sales,
    });
    repo.createCampaign(campaign, days);

    return NextResponse.json({ campaign: { ...campaign, days }, slug: campaign.slug });
  } catch (err) {
    console.error("generate error", err);
    return NextResponse.json(
      { error: "Generation failed. " + (err instanceof Error ? err.message : "") },
      { status: 500 }
    );
  }
}
