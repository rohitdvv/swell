import { repo } from "@/lib/db";
import { getCreativePng, renderCreativePng } from "@/lib/creative";

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

  // Aspect ratios: default 4:5 poster (cached), plus ad/share formats.
  const url = new URL(request.url);
  const ar = url.searchParams.get("ar");
  const isOg = !!url.searchParams.get("og");
  const AR: Record<string, { w: number; h: number }> = {
    "1x1": { w: 1080, h: 1080 }, // Meta / Instagram feed
    "9x16": { w: 1080, h: 1920 }, // Stories / Reels / TikTok
    "1.91x1": { w: 1200, h: 628 }, // Google / Meta landscape
    "4x5": { w: 1080, h: 1350 }, // default portrait
  };
  const size = isOg ? { w: 1200, h: 630 } : ar && AR[ar] ? AR[ar] : { w: 1080, h: 1350 };

  // Default portrait poster is disk-cached; other formats render fresh on demand.
  const png =
    isOg || (ar && ar !== "4x5")
      ? await renderCreativePng(day, campaign, size)
      : await getCreativePng(day, campaign, size);
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
