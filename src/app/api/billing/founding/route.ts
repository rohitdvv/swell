import { NextResponse } from "next/server";
import { foundingStatus, FOUNDING_RATE, STANDARD_RATE } from "@/lib/billing/founding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The real founding-100 count, for the pricing page. */
export async function GET() {
  const s = await foundingStatus();
  return NextResponse.json(
    { ...s, foundingRate: FOUNDING_RATE, standardRate: STANDARD_RATE },
    { headers: { "cache-control": "public, max-age=60" } }
  );
}
