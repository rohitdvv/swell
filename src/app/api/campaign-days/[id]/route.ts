import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { projectDay } from "@/lib/project";
import { generateSingleCopy } from "@/lib/copy";
import { invalidateCreative } from "@/lib/creative";
import { z } from "zod";
import { DAYPARTS, DAYPART_WINDOWS, type Daypart } from "@/lib/types";
import { dowShort } from "@/lib/utils";
import { requireOwner } from "@/lib/authz";
import { runGuardrail } from "@/lib/copy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every editable field, typed and bounded. Unknown keys are dropped. */
const Body = z.object({
  daypart: z.enum(DAYPARTS as [Daypart, ...Daypart[]]).optional(),
  pct_off: z.number().finite().optional(),
  item: z.string().trim().min(1).max(80).optional(),
  copy: z.string().trim().min(1).max(160).optional(),
  regenerateCopy: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const day = await repo.getDayById(id);
  const campaign = day ? await repo.getCampaignById(day.campaign_id) : null;
  const denied = await requireOwner(campaign);
  if (denied) return denied;
  if (!day || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid edit.", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  // Hand-written captions go through the same claims guardrail as generated ones.
  if (body.copy) {
    const g = runGuardrail(body.copy);
    if (!g.ok) {
      return NextResponse.json(
        { error: `That caption didn't pass the guardrail: ${g.reason}.` },
        { status: 422 }
      );
    }
  }

  const nextDaypart: Daypart = body.daypart || day.daypart;
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

  // Anything that appears ON the poster changed? Drop every cached rendition
  // and version the URL so browsers can't keep showing the stale image.
  const posterChanged =
    nextItem !== day.item ||
    nextPct !== day.pct_off ||
    copy !== day.copy ||
    nextDaypart !== day.daypart;
  if (posterChanged) await invalidateCreative(id);

  const updated = await repo.updateDay(id, {
    daypart: nextDaypart,
    discount_window,
    item: nextItem,
    pct_off: nextPct,
    projected_redemptions,
    projected_revenue,
    copy,
    ...(posterChanged ? { creative_url: `/api/creative/${id}.png?v=${Date.now()}` } : {}),
  });

  const refreshed = await repo.getCampaignById(day.campaign_id);
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
