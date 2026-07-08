import { NextResponse } from "next/server";
import { repo } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const campaign = repo.getCampaignBySlug(slug);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ campaign });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const campaign = repo.getCampaignBySlug(slug);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  repo.archive(campaign.id);
  return NextResponse.json({ ok: true });
}
