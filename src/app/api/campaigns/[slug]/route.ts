import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { requireOwner, requireViewer, toPublic } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** Published campaigns + the demo are public; drafts are owner-only. */
export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const campaign = await repo.getCampaignBySlug(slug);
  const denied = await requireViewer(campaign);
  if (denied) return denied;
  return NextResponse.json({ campaign: toPublic(campaign!) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const campaign = await repo.getCampaignBySlug(slug);
  const denied = await requireOwner(campaign);
  if (denied) return denied;
  await repo.archive(campaign!.id);
  return NextResponse.json({ ok: true });
}
