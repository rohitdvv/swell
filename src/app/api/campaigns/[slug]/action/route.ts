import { NextResponse } from "next/server";
import { repo } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const campaign = await repo.getCampaignBySlug(slug);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action } = await request.json().catch(() => ({ action: "" }));
  switch (action) {
    case "activate":
      await repo.setPaused(campaign.id, false);
      break;
    case "pause":
      await repo.setPaused(campaign.id, true);
      break;
    case "publish":
      await repo.publish(campaign.id);
      break;
    case "archive":
      await repo.archive(campaign.id);
      return NextResponse.json({ ok: true, archived: true });
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await repo.getCampaignBySlug(slug);
  return NextResponse.json({ ok: true, campaign: updated });
}
