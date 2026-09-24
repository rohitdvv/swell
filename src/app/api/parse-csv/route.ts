import { NextResponse } from "next/server";
import { parseSalesFile, SalesParseError } from "@/lib/csv";
import { buildSampleCsv } from "@/lib/sample";
import { summarize, fileToRows } from "@/lib/csv";
import { getAccountEmail } from "@/lib/billing/account";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 90 days of a busy restaurant's line items is ~2–6 MB of CSV. 15 MB is generous. */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXT = /\.(csv|xlsx|xls)$/i;

export async function POST(request: Request) {
  const email = await getAccountEmail();
  if (!email) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const limited = await rateLimit(`parse:${email}`, { limit: 40, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  // Refuse oversized bodies from the header, before reading a single byte.
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "That file is over 15 MB — export a shorter date range." }, { status: 413 });
  }

  const contentType = request.headers.get("content-type") || "";
  try {
    // Sample path (JSON { sample: true })
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      if (body?.sample === true) {
        const { csv, meta } = buildSampleCsv(45);
        const sales = summarize(fileToRows(Buffer.from(csv), "sample.csv"), meta.restaurant_name);
        return NextResponse.json({
          sales,
          meta: {
            name: meta.restaurant_name,
            website: meta.website,
            location: meta.location,
            filename: "osteria-lume-toast-export.csv",
          },
          sample: true,
        });
      }
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "That file is over 15 MB — export a shorter date range." }, { status: 413 });
    }
    if (!ALLOWED_EXT.test(file.name)) {
      return NextResponse.json({ error: "Upload a CSV or Excel export (.csv, .xlsx)." }, { status: 415 });
    }
    const rawName = form.get("name");
    const name = (typeof rawName === "string" && rawName.trim() ? rawName : file.name.replace(/\.[^.]+$/, ""))
      .trim()
      .slice(0, 120);
    const buf = Buffer.from(await file.arrayBuffer());
    const sales = parseSalesFile(buf, file.name, name);
    return NextResponse.json({ sales, meta: { name, filename: file.name.slice(0, 200) } });
  } catch (err) {
    if (err instanceof SalesParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("parse-csv error", err);
    return NextResponse.json(
      { error: "Could not parse this file. Expect a Toast/Square transaction export (CSV or XLSX)." },
      { status: 400 }
    );
  }
}
