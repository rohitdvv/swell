import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { requireOwner } from "@/lib/authz";
import { fileToRows, summarize, itemLines, SalesParseError } from "@/lib/csv";
import { trainSalesModel } from "@/lib/model";
import { measureProof } from "@/lib/proof";
import { getAccountEmail } from "@/lib/billing/account";
import { rateLimit } from "@/lib/rate-limit";
import { readUpload, MAX_UPLOAD_BYTES, ALLOWED_EXT, UploadTooLargeError } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * Proof: the owner uploads their POS export covering the campaign. We measure
 * lift against the model trained on the ORIGINAL (pre-campaign) sales — the
 * new file never trains the counterfactual it is judged against.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaign = await repo.getCampaignBySlug(slug);
  const denied = await requireOwner(campaign);
  if (denied) return denied;

  const email = (await getAccountEmail())!;
  const limited = await rateLimit(`proof:${email}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "That file is over 15 MB — export a shorter date range." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "That file is over 15 MB — export a shorter date range." }, { status: 413 });
    }
    if (!ALLOWED_EXT.test(file.name)) {
      return NextResponse.json({ error: "Upload a CSV or Excel export (.csv, .xlsx)." }, { status: 415 });
    }

    const upload = await readUpload(file);
    const rows = fileToRows(upload.buf, upload.name);
    let after;
    try {
      after = summarize(rows, campaign!.restaurant_name);
    } catch (e) {
      // Proof needs only the campaign days, so a short export is fine — but it must parse.
      if (e instanceof SalesParseError && /at least 14 days/.test(e.message)) after = null;
      else throw e;
    }
    const daily = after?.daily ?? dailyFromRows(rows);

    const model = trainSalesModel(campaign!.sales_summary);
    if (!model) {
      return NextResponse.json(
        { error: "This campaign's original sales history is too short to build a baseline." },
        { status: 422 }
      );
    }
    const report = measureProof({
      model,
      days: campaign!.days,
      after: daily,
      lines: itemLines(rows),
      campaignStart: campaign!.start_date,
    });
    if (report.days_covered === 0) {
      return NextResponse.json(
        {
          error: `That export has no sales from the campaign dates (${campaign!.start_date} onward). Export a range that includes them.`,
        },
        { status: 422 }
      );
    }
    await repo.setProof(campaign!.id, report);
    return NextResponse.json({ proof: report });
  } catch (err) {
    if (err instanceof UploadTooLargeError) return NextResponse.json({ error: err.message }, { status: 413 });
    if (err instanceof SalesParseError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("proof error", err);
    return NextResponse.json(
      { error: "Could not read this file. Expect the same Toast/Square export you started with." },
      { status: 400 }
    );
  }
}

/** Daily totals straight from rows, for exports shorter than the 14-day summary minimum. */
function dailyFromRows(rows: Record<string, string>[]) {
  const lines = itemLines(rows);
  const byDate = new Map<string, number>();
  for (const l of lines) byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.net);
  return [...byDate.entries()].map(([date, net_sales]) => ({ date, net_sales, orders: 0 }));
}
