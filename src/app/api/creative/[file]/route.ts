import { repo } from "@/lib/db";
import { getCreativePng } from "@/lib/creative";
import { requireViewer, DEMO_SLUG } from "@/lib/authz";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AR: Record<string, { w: number; h: number }> = {
  "1x1": { w: 1080, h: 1080 }, // Meta / Instagram feed
  "9x16": { w: 1080, h: 1920 }, // Stories / Reels / TikTok
  "1.91x1": { w: 1200, h: 628 }, // Google / Meta landscape
  "4x5": { w: 1080, h: 1350 }, // default portrait
};

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const dayId = file.replace(/\.(png|jpg|jpeg)$/i, "");
  if (!/^[0-9a-f-]{36}$/i.test(dayId)) return new Response("Not found", { status: 404 });

  // Generous — a poster gallery loads 30 at once — but bounded.
  const limited = await rateLimit(`creative:${clientIp(request)}`, { limit: 400, windowMs: 60_000 });
  if (limited) return limited;

  const day = await repo.getDayById(dayId);
  const campaign = day ? await repo.getCampaignById(day.campaign_id) : null;
  const denied = await requireViewer(campaign);
  if (denied) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const ar = url.searchParams.get("ar");
  const isOg = !!url.searchParams.get("og");
  const size = isOg ? { w: 1200, h: 630 } : ar && AR[ar] ? AR[ar] : AR["4x5"];

  // Every size is disk-cached (edits invalidate all of a day's renditions),
  // so repeated requests never re-run the renderer.
  const png = await getCreativePng(day!, campaign!, size);
  const isPublic = campaign!.status === "published" || campaign!.slug === DEMO_SLUG;
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "x-content-type-options": "nosniff",
      "cache-control": isPublic
        ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
        : "private, max-age=300",
    },
  });
}
