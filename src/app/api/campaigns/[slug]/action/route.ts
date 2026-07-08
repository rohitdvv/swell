import { NextResponse } from "next/server";
import { repo } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const campaign = repo.getCampaignBySlug(slug);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action } = await request.json().catch(() => ({ action: "" }));
  switch (action) {
    case "activate":
      repo.setPaused(campaign.id, false);
      break;
    case "pause":
      repo.setPaused(campaign.id, true);
      break;
    case "publish":
      repo.publish(campaign.id);
      break;
    case "archive":
      repo.archive(campaign.id);
      return NextResponse.json({ ok: true, archived: true });
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = repo.getCampaignBySlug(slug);
  return NextResponse.json({ ok: true, campaign: updated });
}
