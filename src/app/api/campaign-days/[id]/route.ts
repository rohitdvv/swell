import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { projectDay } from "@/lib/project";
import { generateSingleCopy } from "@/lib/copy";
import { DAYPART_WINDOWS, type Daypart } from "@/lib/types";
import { dowShort } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const day = repo.getDayById(id);
  if (!day) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const campaign = repo.getCampaignById(day.campaign_id);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  const nextDaypart: Daypart = (body.daypart as Daypart) || day.daypart;
  const nextPct = typeof body.pct_off === "number" ? clampPct(body.pct_off) : day.pct_off;
  const nextItem = typeof body.item === "string" && body.item.trim() ? body.item.trim() : day.item;
  const discount_window = DAYPART_WINDOWS[nextDaypart] || day.discount_window;

  const pricingChanged = nextPct !== day.pct_off || nextDaypart !== day.daypart;
  const { projected_redemptions, projected_revenue } = pricingChanged
    ? projectDay(campaign.sales_summary, campaign.marketplace, day.dow, nextDaypart, nextPct)
    : { projected_redemptions: day.projected_redemptions, projected_revenue: day.projected_revenue };

  let copy = typeof body.copy === "string" ? body.copy : day.copy;
  if (body.regenerateCopy) {
    const result = await generateSingleCopy({
      restaurantName: campaign.restaurant_name,
      item: nextItem,
      daypart: nextDaypart,
      window: discount_window,
      pctOff: nextPct,
      dow: dowShort(day.date),
      voiceSummary: campaign.brand.voice_summary,
      voiceKeywords: campaign.brand.voice_keywords || [],
      seed: `${campaign.id}:${day.day_index}:${Date.now()}`,
    });
    copy = result.copy;
  }

  const updated = repo.updateDay(id, {
    daypart: nextDaypart,
    discount_window,
    item: nextItem,
    pct_off: nextPct,
    projected_redemptions,
    projected_revenue,
    copy,
  });

  const refreshed = repo.getCampaignById(day.campaign_id);
  return NextResponse.json({
    day: updated,
    totals: {
      projected_revenue: refreshed?.projected_revenue,
      projected_redemptions: refreshed?.projected_redemptions,
    },
  });
}

function clampPct(n: number): number {
  return Math.max(5, Math.min(60, Math.round(n)));
}
