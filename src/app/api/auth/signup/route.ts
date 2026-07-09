import { NextResponse } from "next/server";
import { signUp } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await signUp({
    email: body?.email || "",
    name: body?.name || "",
    restaurant_name: body?.restaurant_name || "",
    password: body?.password || "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  return NextResponse.json({ ok: true, user: result.user });
}
