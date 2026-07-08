import "server-only";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import type { Campaign, CampaignDay } from "./types";
import { dowFull, formatShortDate } from "./utils";
import { resolveFoodImageUrl } from "./food-images";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function darken(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const r = Math.max(0, parseInt(h.slice(0, 2), 16) - amt);
  const g = Math.max(0, parseInt(h.slice(2, 4), 16) - amt);
  const b = Math.max(0, parseInt(h.slice(4, 6), 16) - amt);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const logoCache = new Map<string, string | null>();
async function logoDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (logoCache.has(url)) return logoCache.get(url)!;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error("bad");
    const buf = Buffer.from(await res.arrayBuffer());
    const png = await sharp(buf).resize(120, 120, { fit: "inside" }).png().toBuffer();
    const uri = `data:image/png;base64,${png.toString("base64")}`;
    logoCache.set(url, uri);
    return uri;
  } catch {
    logoCache.set(url, null);
    return null;
  }
}

const bgCache = new Map<string, Buffer | null>();
async function fetchImage(url: string): Promise<Buffer | null> {
  if (bgCache.has(url)) return bgCache.get(url)!;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error("bad");
    const buf = Buffer.from(await res.arrayBuffer());
    // validate it's a raster image sharp can read
    await sharp(buf).metadata();
    bgCache.set(url, buf);
    return buf;
  } catch {
    bgCache.set(url, null);
    return null;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

// ---- Fallback: brand-gradient poster (no photo available) --
function buildGradientSvg(
  day: Pick<CampaignDay, "item" | "pct_off" | "discount_window" | "date" | "copy">,
  campaign: Pick<Campaign, "restaurant_name" | "brand">,
  logoUri: string | null,
  size: { w: number; h: number }
): string {
  const brand = campaign.brand;
  const primary = brand.primary_color || "#f75410";
  const fg = brand.text_on_primary === "dark" ? "#141210" : "#ffffff";
  const fgMuted = brand.text_on_primary === "dark" ? "rgba(20,18,16,0.66)" : "rgba(255,255,255,0.74)";
  const chipBg = brand.text_on_primary === "dark" ? "rgba(20,18,16,0.08)" : "rgba(255,255,255,0.14)";
  const font = "'Geist','Inter','Helvetica Neue',Arial,sans-serif";
  const { w, h } = size;
  const dow = dowFull(day.date);
  const logo = logoUri
    ? `<clipPath id="lc"><circle cx="96" cy="112" r="34"/></clipPath>
       <circle cx="96" cy="112" r="37" fill="${chipBg}"/>
       <image href="${logoUri}" x="62" y="78" width="68" height="68" clip-path="url(#lc)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="96" cy="112" r="37" fill="${chipBg}"/>
       <text x="96" y="124" font-family="${font}" font-size="34" font-weight="700" fill="${fg}" text-anchor="middle">${esc(
         campaign.restaurant_name.slice(0, 1)
       )}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${darken(primary, 60)}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.8" cy="0.1" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  ${logo}
  <text x="150" y="98" font-family="${font}" font-size="34" font-weight="600" fill="${fg}">${esc(campaign.restaurant_name)}</text>
  <text x="150" y="134" font-family="${font}" font-size="22" font-weight="500" fill="${fgMuted}">${esc(brand.voice_summary)}</text>
  <text x="80" y="${h * 0.42}" font-family="${font}" font-size="230" font-weight="800" fill="${fg}" letter-spacing="-8">${day.pct_off}%</text>
  <text x="88" y="${h * 0.42 + 74}" font-family="${font}" font-size="72" font-weight="700" fill="${fg}" letter-spacing="6">OFF</text>
  <text x="80" y="${h * 0.42 + 190}" font-family="${font}" font-size="64" font-weight="700" fill="${fg}">${esc(truncate(day.item, 22))}</text>
  <text x="80" y="${h * 0.42 + 250}" font-family="${font}" font-size="30" font-weight="500" fill="${fgMuted}">${esc(dow)} · ${esc(day.discount_window)}</text>
  <rect x="76" y="${h - 260}" width="${w - 152}" height="2" fill="${chipBg}"/>
  <text x="80" y="${h - 200}" font-family="${font}" font-size="34" font-weight="500" fill="${fg}">“${esc(truncate(day.copy, 46))}”</text>
  <g transform="translate(80, ${h - 96})">
    <rect x="0" y="-34" width="150" height="50" rx="25" fill="${chipBg}"/>
    <text x="26" y="0" font-family="${font}" font-size="26" font-weight="700" fill="${fg}">Swell</text>
    <circle cx="16" cy="-9" r="5" fill="${fg}"/>
  </g>
  <text x="${w - 80}" y="${h - 62}" font-family="${font}" font-size="24" font-weight="500" fill="${fgMuted}" text-anchor="end">${esc(formatShortDate(day.date))} · flash deal</text>
</svg>`;
}

// ---- Photo poster: text + scrims composited over food image --
function buildBrandTintSvg(w: number, h: number, primary: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${primary}" fill-opacity="0.5"/></svg>`;
}

function buildPhotoOverlaySvg(
  day: Pick<CampaignDay, "item" | "pct_off" | "discount_window" | "date" | "copy">,
  campaign: Pick<Campaign, "restaurant_name" | "brand">,
  logoUri: string | null,
  size: { w: number; h: number }
): string {
  const { w, h } = size;
  const primary = campaign.brand.primary_color || "#f75410";
  const font = "'Geist','Inter','Helvetica Neue',Arial,sans-serif";
  const dow = dowFull(day.date);
  const pillW = 210;
  const pillX = w - 56 - pillW;
  const logo = logoUri
    ? `<clipPath id="lc"><circle cx="90" cy="90" r="30"/></clipPath>
       <circle cx="90" cy="90" r="33" fill="rgba(255,255,255,0.16)"/>
       <image href="${logoUri}" x="60" y="60" width="60" height="60" clip-path="url(#lc)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="90" cy="90" r="33" fill="rgba(255,255,255,0.16)"/>
       <text x="90" y="101" font-family="${font}" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${esc(
         campaign.restaurant_name.slice(0, 1)
       )}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.42"/>
      <stop offset="0.34" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.58" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#scrim)"/>

  ${logo}
  <text x="140" y="82" font-family="${font}" font-size="32" font-weight="600" fill="#fff">${esc(truncate(campaign.restaurant_name, 22))}</text>
  <text x="140" y="112" font-family="${font}" font-size="20" font-weight="500" fill="rgba(255,255,255,0.8)">${esc(campaign.brand.voice_summary)}</text>

  <rect x="${pillX}" y="52" width="${pillW}" height="66" rx="33" fill="${primary}"/>
  <text x="${pillX + pillW / 2}" y="95" font-family="${font}" font-size="34" font-weight="800" fill="#fff" text-anchor="middle">${day.pct_off}% OFF</text>

  <text x="72" y="${h - 236}" font-family="${font}" font-size="66" font-weight="800" fill="#fff">${esc(truncate(day.item, 24))}</text>
  <text x="72" y="${h - 188}" font-family="${font}" font-size="30" font-weight="600" fill="${primary}" style="filter:brightness(1.6)">${esc(dow)} · ${esc(day.discount_window)}</text>
  <text x="72" y="${h - 140}" font-family="${font}" font-size="32" font-weight="500" fill="rgba(255,255,255,0.94)">“${esc(truncate(day.copy, 48))}”</text>

  <g transform="translate(72, ${h - 66})">
    <circle cx="8" cy="-8" r="5" fill="${primary}"/>
    <text x="24" y="0" font-family="${font}" font-size="26" font-weight="700" fill="#fff">Swell</text>
  </g>
  <text x="${w - 72}" y="${h - 66}" font-family="${font}" font-size="24" font-weight="500" fill="rgba(255,255,255,0.72)" text-anchor="end">${esc(formatShortDate(day.date))} · flash deal</text>
</svg>`;
}

async function resolveBackground(
  day: CampaignDay,
  campaign: Campaign
): Promise<Buffer | null> {
  const images = campaign.brand.image_urls ?? [];
  const candidates: string[] = [];
  if (images.length) candidates.push(images[day.day_index % images.length]);
  const food = await resolveFoodImageUrl(day.item);
  if (food) candidates.push(food);
  for (const url of candidates) {
    const buf = await fetchImage(url);
    if (buf) return buf;
  }
  return null;
}

// ---- disk cache (survives restarts; "Vercel Blob" in prod) --
function creativesDir(): string {
  const candidates = [
    process.env.SWELL_CREATIVES,
    path.join(process.cwd(), "data", "creatives"),
    path.join("/tmp", "swell-creatives"),
  ].filter(Boolean) as string[];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      /* try next */
    }
  }
  return "/tmp";
}

/** Render with a disk cache — the poster for a day is only composited once. */
export async function getCreativePng(
  day: CampaignDay,
  campaign: Campaign,
  size: { w: number; h: number } = { w: 1080, h: 1350 }
): Promise<Buffer> {
  const file = path.join(creativesDir(), `${day.id}-${size.w}x${size.h}.png`);
  try {
    return await fs.promises.readFile(file);
  } catch {
    /* not cached yet */
  }
  const png = await renderCreativePng(day, campaign, size);
  fs.promises.writeFile(file, png).catch(() => {});
  return png;
}

/** Fire-and-forget pre-render of every poster so the gallery is instant. */
export async function prewarmCreatives(days: CampaignDay[], campaign: Campaign): Promise<void> {
  for (const d of days) {
    try {
      await getCreativePng(d, campaign);
    } catch {
      /* keep going */
    }
  }
}

export async function renderCreativePng(
  day: CampaignDay,
  campaign: Campaign,
  size: { w: number; h: number } = { w: 1080, h: 1350 }
): Promise<Buffer> {
  const { w, h } = size;
  const primary = campaign.brand.primary_color || "#f75410";
  const logoUri = await logoDataUri(campaign.brand.logo_url);

  const bg = await resolveBackground(day, campaign);
  if (bg) {
    const photo = await sharp(bg)
      .resize(w, h, { fit: "cover", position: "attention" })
      .toBuffer();
    const overlay = buildPhotoOverlaySvg(day, campaign, logoUri, size);
    return sharp(photo)
      .composite([
        { input: Buffer.from(buildBrandTintSvg(w, h, primary)), blend: "multiply" },
        { input: Buffer.from(overlay), blend: "over" },
      ])
      .png()
      .toBuffer();
  }

  // Fallback: pure brand-gradient poster
  const svg = buildGradientSvg(day, campaign, logoUri, size);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
