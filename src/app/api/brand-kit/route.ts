import { NextResponse } from "next/server";
import { z } from "zod";
import { extractBrandKit, neutralBrandKit } from "@/lib/brand";
import { getAccountEmail } from "@/lib/billing/account";
import { rateLimit } from "@/lib/rate-limit";
import { assertSafeUrl, UnsafeUrlError } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  url: z.string().trim().max(2048).optional().default(""),
  name: z.string().trim().max(120).optional().default(""),
});

export async function POST(request: Request) {
  const email = await getAccountEmail();
  if (!email) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  // Each call makes outbound requests to a user-chosen host — cap it.
  const limited = await rateLimit(`brandkit:${email}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { url, name } = parsed.data;

  if (!url) return NextResponse.json({ brand: neutralBrandKit(name || "Your Restaurant") });

  // Friendly early rejection; the real enforcement is at connect time in safeFetch.
  try {
    assertSafeUrl(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch (e) {
    if (e instanceof UnsafeUrlError) {
      return NextResponse.json({ error: "Enter your restaurant's public website address." }, { status: 400 });
    }
    throw e;
  }

  try {
    const brand = await extractBrandKit(url);
    if (name && !brand.name) brand.name = name;
    return NextResponse.json({ brand });
  } catch (err) {
    console.error("brand-kit error", err);
    return NextResponse.json({ error: "Could not read that website." }, { status: 400 });
  }
}
