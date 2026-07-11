import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { campaignToIcs } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** Public ICS feed — owners subscribe Google/Apple Calendar to the campaign. */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const campaign = await repo.getCampaignBySlug(slug);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const ics = campaignToIcs(campaign);
  const filename = `${campaign.slug}-offers.ics`;
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "public, max-age=300",
    },
  });
}
