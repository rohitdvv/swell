import { NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/db";
import { requireOwner, toPublic } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ action: z.enum(["activate", "pause", "publish", "archive"]) });

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaign = await repo.getCampaignBySlug(slug);
  const denied = await requireOwner(campaign);
  if (denied) return denied;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const id = campaign!.id;
  switch (parsed.data.action) {
    case "activate":
      await repo.setPaused(id, false);
      break;
    case "pause":
      await repo.setPaused(id, true);
      break;
    case "publish":
      await repo.publish(id);
      break;
    case "archive":
      await repo.archive(id);
      return NextResponse.json({ ok: true, archived: true });
  }

  const updated = await repo.getCampaignBySlug(slug);
  return NextResponse.json({ ok: true, campaign: updated ? toPublic(updated) : null });
}
