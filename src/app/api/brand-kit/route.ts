import { NextResponse } from "next/server";
import { extractBrandKit, neutralBrandKit } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url: string = (body?.url || "").trim();
    const name: string = (body?.name || "").trim();

    if (!url) {
      return NextResponse.json({ brand: neutralBrandKit(name || "Your Restaurant") });
    }
    const brand = await extractBrandKit(url);
    if (name && !brand.name) brand.name = name;
    return NextResponse.json({ brand });
  } catch (err) {
    console.error("brand-kit error", err);
    return NextResponse.json({ error: "Could not read that website." }, { status: 400 });
  }
}
