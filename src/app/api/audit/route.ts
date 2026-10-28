import { NextResponse } from "next/server";
import { fileToRows, summarize, itemLines, detectVenue, SalesParseError } from "@/lib/csv";
import { readUpload, MAX_UPLOAD_BYTES, ALLOWED_EXT, UploadTooLargeError } from "@/lib/upload";
import { findMoney, checkCampaign, suggestStart, AuditInputError } from "@/lib/audit";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The free audit. Public on purpose — the fastest way for an owner to see
 * what Swell is worth is their own numbers, before any sign-up. The export is
 * parsed in memory and discarded; only the report is returned. Rate-limited
 * per IP so it can't be used as free compute.
 */
export async function POST(request: Request) {
  const limited = await rateLimit(`audit:${clientIp(request)}`, { limit: 12, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "That file is over 15 MB — export a shorter date range." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Upload your POS export." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "That file is over 15 MB — export a shorter date range." }, { status: 413 });
    }
    if (!ALLOWED_EXT.test(file.name)) {
      return NextResponse.json({ error: "Upload a CSV or Excel export (.csv, .xlsx)." }, { status: 415 });
    }

    const { buf, name } = await readUpload(file);
    const rows = fileToRows(buf, name);
    const venue = detectVenue(rows);
    const sales = summarize(rows, venue.name ?? "Your restaurant");
    const mode = form.get("mode") === "check" ? "check" : "find";

    if (mode === "find") {
      return NextResponse.json({ mode, venue, report: findMoney(sales), suggestedStart: suggestStart(sales) });
    }

    const start = String(form.get("start") ?? "");
    const end = String(form.get("end") ?? "");
    const spend = Number(form.get("spend") ?? 0);
    if (!ISO.test(start)) {
      return NextResponse.json({ error: "Pick the date the campaign started.", suggestedStart: suggestStart(sales) }, { status: 400 });
    }
    const report = checkCampaign({
      sales,
      lines: itemLines(rows),
      start,
      end: ISO.test(end) ? end : undefined,
      monthlySpend: Number.isFinite(spend) && spend > 0 && spend < 1_000_000 ? spend : undefined,
    });
    return NextResponse.json({ mode, venue, report });
  } catch (err) {
    if (err instanceof UploadTooLargeError) return NextResponse.json({ error: err.message }, { status: 413 });
    if (err instanceof SalesParseError || err instanceof AuditInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("audit error", err);
    return NextResponse.json(
      { error: "Could not read this file. Expect a Toast, Square or Clover sales export (CSV or Excel)." },
      { status: 400 }
    );
  }
}
