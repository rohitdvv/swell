import { buildSampleCsv } from "@/lib/sample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { csv } = buildSampleCsv(45);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="osteria-lume-toast-export.csv"',
    },
  });
}
