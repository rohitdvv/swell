import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { getAccountEmail } from "@/lib/billing/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const email = await getAccountEmail();
  if (!email) return NextResponse.json({ runs: [] });
  const runs = await repo.listRuns(email, 20);
  return NextResponse.json({ runs });
}
