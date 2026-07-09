import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await signIn({ email: body?.email || "", password: body?.password || "" });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 401 });
  return NextResponse.json({ ok: true, user: result.user });
}
