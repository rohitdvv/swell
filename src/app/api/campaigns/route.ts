import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { getAccountEmail } from "@/lib/billing/account";
import { toPublic } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in owner's campaigns — never another tenant's. */
export async function GET() {
  const email = await getAccountEmail();
  if (!email) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const campaigns = await repo.listCampaigns(email);
  return NextResponse.json({ campaigns: campaigns.map(toPublic) });
}
