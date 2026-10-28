import { NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LeadSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).regex(/^[0-9+().\-\s]*$/, "digits only").optional(),
  restaurant: z.string().trim().max(160).optional(),
  source: z.enum(["audit", "landing", "pricing", "check"]),
  note: z.string().trim().max(1000).optional(),
  foundPerMonth: z.number().int().min(0).max(10_000_000).optional(),
});

/** "Talk to a founder" — stored for the founder dashboard (/admin). */
export async function POST(request: Request) {
  const limited = await rateLimit(`lead:${clientIp(request)}`, { limit: 6, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const parsed = LeadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check your email address and try again." }, { status: 400 });
  const l = parsed.data;
  await repo.addLead({
    email: l.email,
    name: l.name || null,
    phone: l.phone || null,
    restaurant: l.restaurant || null,
    source: l.source,
    note: l.note || null,
    found_per_month: l.foundPerMonth ?? null,
  });
  return NextResponse.json({ ok: true });
}
