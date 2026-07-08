import { repo } from "@/lib/db";
import { renderCreativePng } from "@/lib/creative";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const dayId = file.replace(/\.(png|jpg|jpeg)$/i, "");
  const day = repo.getDayById(dayId);
  if (!day) return new Response("Not found", { status: 404 });
  const campaign = repo.getCampaignById(day.campaign_id);
  if (!campaign) return new Response("Not found", { status: 404 });

  // Optional aspect: ?og=1 → 1200x630 for share cards
  const url = new URL(request.url);
  const size = url.searchParams.get("og")
    ? { w: 1200, h: 630 }
    : { w: 1080, h: 1350 };

  const png = await renderCreativePng(day, campaign, size);
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
