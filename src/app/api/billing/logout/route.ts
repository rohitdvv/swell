import { NextResponse } from "next/server";
import { clearAccountCookie } from "@/lib/billing/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearAccountCookie();
  return NextResponse.json({ ok: true });
}
