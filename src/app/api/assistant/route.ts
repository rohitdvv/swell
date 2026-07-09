import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { askAssistant } from "@/lib/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const slug: string = (body?.slug || "").trim();
    const question: string = (body?.question || "").trim().slice(0, 500);
    if (!slug || !question) {
      return NextResponse.json({ error: "Missing slug or question." }, { status: 400 });
    }
    const campaign = await repo.getCampaignBySlug(slug);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    const reply = await askAssistant(question, campaign);
    return NextResponse.json(reply);
  } catch (err) {
    console.error("assistant error", err);
    return NextResponse.json(
      { error: "The assistant hit a snag — try again." },
      { status: 500 }
    );
  }
}
