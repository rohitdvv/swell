import { NextResponse } from "next/server";
import { parseSalesFile, SalesParseError } from "@/lib/csv";
import { buildSampleCsv } from "@/lib/sample";
import { summarize, fileToRows } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  try {
    // Sample path (JSON { sample: true })
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      if (body?.sample) {
        const { csv, meta } = buildSampleCsv(45);
        const sales = summarize(fileToRows(Buffer.from(csv), "sample.csv"), meta.restaurant_name);
        return NextResponse.json({
          sales,
          meta: { name: meta.restaurant_name, website: meta.website, filename: "osteria-lume-toast-export.csv" },
          sample: true,
        });
      }
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // File upload
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    const name = (form.get("name") as string) || file.name.replace(/\.[^.]+$/, "");
    const buf = Buffer.from(await file.arrayBuffer());
    const sales = parseSalesFile(buf, file.name, name);
    return NextResponse.json({
      sales,
      meta: { name, filename: file.name },
    });
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
