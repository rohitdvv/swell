import { NextResponse } from "next/server";
import { SalesParseError } from "@/lib/csv";
import { buildSampleCsv } from "@/lib/sample";
import { summarize, fileToRows, detectVenue } from "@/lib/csv";
import { readUpload, MAX_UPLOAD_BYTES, ALLOWED_EXT, UploadTooLargeError } from "@/lib/upload";
import { getAccountEmail } from "@/lib/billing/account";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


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
    const { buf, name: filename } = await readUpload(file);
    const rows = fileToRows(buf, filename);
    // Toast/Square exports usually name the venue ("Main Street Grill - Austin, TX").
    const venue = detectVenue(rows);
    const rawName = form.get("name");
    const name = (
      typeof rawName === "string" && rawName.trim()
        ? rawName
        : venue.name ?? filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")
    )
      .trim()
      .slice(0, 120);
    const sales = summarize(rows, name);
    return NextResponse.json({
      sales,
      meta: { name, filename: filename.slice(0, 200), location: venue.location },
    });
  } catch (err) {
    if (err instanceof UploadTooLargeError) {
      return NextResponse.json({ error: err.message }, { status: 413 });
    }
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
