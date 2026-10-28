import { buildSampleCsv } from "@/lib/sample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A sample POS export. `?scenario=campaign` returns 75 days in which a
 * (simulated) campaign lifted orders ~12% from day 50 — so the free audit's
 * "Did my marketing work?" can be tried by anyone without their own data.
 * The campaign start date is returned in the x-campaign-start header.
 */
export async function GET(request: Request) {
  const campaign = new URL(request.url).searchParams.get("scenario") === "campaign";
  const { csv, meta } = campaign ? buildSampleCsv(75, { liftFromDay: 50, liftPct: 0.12 }) : buildSampleCsv(45);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${campaign ? "sample-restaurant-after-campaign" : "osteria-lume-toast-export"}.csv"`,
      ...(meta.campaignStart ? { "x-campaign-start": meta.campaignStart } : {}),
    },
  });
}
