import { NextResponse } from "next/server";
import { repo } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const campaigns = await repo.listCampaigns();
  return NextResponse.json({ campaigns });
}
