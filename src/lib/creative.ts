import "server-only";
import sharp from "sharp";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Campaign, CampaignDay } from "./types";
import { dowFull, formatShortDate, clamp } from "./utils";
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

const FONT = "'Geist','Inter','Helvetica Neue',Arial,sans-serif";

function buildBrandTintSvg(w: number, h: number, primary: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${primary}" fill-opacity="0.5"/></svg>`;
}

/**
 * One adaptive poster layout that composes cleanly at ANY aspect ratio
 * (4:5, 1:1, 9:16, 1.91:1). `mode: "gradient"` draws a full brand background;
 * `mode: "photo"` returns a transparent overlay (scrim + text) for compositing.
 */
function buildOverlaySvg(
  day: Pick<CampaignDay, "item" | "pct_off" | "discount_window" | "date" | "copy">,
  campaign: Pick<Campaign, "restaurant_name" | "brand">,
  logoUri: string | null,
  w: number,
  h: number,
  mode: "gradient" | "photo"
): string {
  const brand = campaign.brand;
  const primary = brand.primary_color || "#f75410";
  const darkText = mode === "gradient" && brand.text_on_primary === "dark";
  const fg = darkText ? "#141210" : "#ffffff";
  const fgMuted = darkText ? "rgba(20,18,16,0.68)" : "rgba(255,255,255,0.78)";
  const chipBg = darkText ? "rgba(20,18,16,0.10)" : "rgba(255,255,255,0.16)";

  const pad = Math.round(w * 0.055);
  const k = Math.min(Math.max(Math.min(w, h) / 1080, 0.55), 1.35);
  const dow = dowFull(day.date);

  // header
  const r = Math.round(30 * k);
  const cx = pad + r;
  const cy = pad + r;
  const nameX = cx + r + Math.round(16 * k);
  const nameFont = Math.round(30 * k);
  const logo = logoUri
    ? `<clipPath id="lc"><circle cx="${cx}" cy="${cy}" r="${r - 3}"/></clipPath>
       <circle cx="${cx}" cy="${cy}" r="${r}" fill="${chipBg}"/>
       <image href="${logoUri}" x="${cx - r + 3}" y="${cy - r + 3}" width="${(r - 3) * 2}" height="${(r - 3) * 2}" clip-path="url(#lc)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${chipBg}"/>
       <text x="${cx}" y="${cy + nameFont * 0.36}" font-family="${FONT}" font-size="${Math.round(30 * k)}" font-weight="700" fill="${fg}" text-anchor="middle">${esc(
         campaign.restaurant_name.slice(0, 1)
       )}</text>`;

  // discount pill (top-right)
  const pillText = `${day.pct_off}% OFF`;
  const pillFont = Math.round(30 * k);
  const pillH = Math.round(pillFont * 2.1);
  const pillW = Math.round(pillText.length * pillFont * 0.62 + pillFont * 1.4);
  const pillX = w - pad - pillW;

  // bottom stack (anchored to bottom, proportional gaps)
  const footY = h - pad;
  const copyFont = Math.round(clamp(30 * k, 15, 34));
  const winFont = Math.round(clamp(27 * k, 14, 30));
  const copyY = footY - Math.round(38 * k);
  const winY = copyY - Math.round(copyFont * 1.25);
  // auto-fit item to width
  const itemStr = truncate(day.item, 26);
  const maxItemW = w - pad * 2;
  const itemFont = Math.round(
    clamp(Math.min(64 * k, maxItemW / (0.6 * Math.max(itemStr.length, 8))), 26, 86)
  );
  const itemY = winY - Math.round(winFont * 1.5);

  // big % number — only when there is clear vertical room above the item block
  const headerBottom = cy + r + Math.round(10 * k);
  const topSpace = itemY - itemFont - headerBottom;
  let bigBlock = "";
  if (topSpace > 150 * k) {
    const bigFont = Math.round(Math.min(w * 0.34, topSpace * 0.62));
    const bigY = headerBottom + bigFont;
    bigBlock = `
  <text x="${pad}" y="${bigY}" font-family="${FONT}" font-size="${bigFont}" font-weight="800" fill="${fg}" letter-spacing="-${Math.round(bigFont * 0.03)}">${day.pct_off}%</text>
  <text x="${pad + Math.round(6 * k)}" y="${bigY + Math.round(bigFont * 0.32)}" font-family="${FONT}" font-size="${Math.round(bigFont * 0.3)}" font-weight="700" fill="${fg}" letter-spacing="${Math.round(bigFont * 0.02)}">OFF</text>`;
  }

  const bg =
    mode === "gradient"
      ? `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${darken(primary, 60)}"/></linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${darkText ? 0 : 0.28}"/></linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#scrim)"/>`
      : `<defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.44"/>
      <stop offset="0.32" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#scrim)"/>`;

  const accent = mode === "photo" ? "#ffffff" : fg;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${bg}
  ${logo}
  <text x="${nameX}" y="${cy - Math.round(2 * k)}" font-family="${FONT}" font-size="${nameFont}" font-weight="600" fill="${fg}">${esc(truncate(campaign.restaurant_name, 22))}</text>
  <text x="${nameX}" y="${cy + Math.round(24 * k)}" font-family="${FONT}" font-size="${Math.round(19 * k)}" font-weight="500" fill="${fgMuted}">${esc(brand.voice_summary)}</text>

  <rect x="${pillX}" y="${pad}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${primary}"/>
  <text x="${pillX + pillW / 2}" y="${pad + pillH / 2 + pillFont * 0.36}" font-family="${FONT}" font-size="${pillFont}" font-weight="800" fill="#ffffff" text-anchor="middle">${pillText}</text>
  ${bigBlock}

  <text x="${pad}" y="${itemY}" font-family="${FONT}" font-size="${itemFont}" font-weight="800" fill="${fg}">${esc(itemStr)}</text>
  <text x="${pad}" y="${winY}" font-family="${FONT}" font-size="${winFont}" font-weight="600" fill="${accent}" opacity="0.92">${esc(dow)} · ${esc(day.discount_window)}</text>
  <text x="${pad}" y="${copyY}" font-family="${FONT}" font-size="${copyFont}" font-weight="500" fill="${fg}" opacity="0.95">“${esc(truncate(day.copy, 52))}”</text>

  <g transform="translate(${pad}, ${footY})">
    <circle cx="${Math.round(6 * k)}" cy="${-Math.round(7 * k)}" r="${Math.round(5 * k)}" fill="${primary === fg ? "#ffffff" : primary}"/>
    <text x="${Math.round(20 * k)}" y="0" font-family="${FONT}" font-size="${Math.round(25 * k)}" font-weight="700" fill="${fg}">Swell</text>
  </g>
  <text x="${w - pad}" y="${footY}" font-family="${FONT}" font-size="${Math.round(23 * k)}" font-weight="500" fill="${fgMuted}" text-anchor="end">${esc(formatShortDate(day.date))} · flash deal</text>
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
// IMPORTANT: cache OUTSIDE the project directory — the Next dev watcher
// reloads the browser whenever files change under the project root, and
// poster writes under ./data caused a refresh loop.
function creativesDir(): string {
  const base = process.env.SWELL_DATA_DIR || path.join(os.homedir(), ".swell");
  const candidates = [
    process.env.SWELL_CREATIVES,
    path.join(base, "creatives"),
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
    const overlay = buildOverlaySvg(day, campaign, logoUri, w, h, "photo");
    return sharp(photo)
      .composite([
        { input: Buffer.from(buildBrandTintSvg(w, h, primary)), blend: "multiply" },
        { input: Buffer.from(overlay), blend: "over" },
      ])
      .png()
      .toBuffer();
  }

  // Fallback: pure brand-gradient poster
  const svg = buildOverlaySvg(day, campaign, logoUri, w, h, "gradient");
  return sharp(Buffer.from(svg)).png().toBuffer();
}
