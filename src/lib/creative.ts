import "server-only";
import sharp from "sharp";
import type { Campaign, CampaignDay } from "./types";
import { dowFull, formatShortDate } from "./utils";

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
    // normalize to png circle-safe raster
    const png = await sharp(buf).resize(120, 120, { fit: "inside" }).png().toBuffer();
    const uri = `data:image/png;base64,${png.toString("base64")}`;
    logoCache.set(url, uri);
    return uri;
  } catch {
    logoCache.set(url, null);
    return null;
  }
}

export function buildCreativeSvg(
  day: Pick<CampaignDay, "item" | "pct_off" | "discount_window" | "date" | "copy">,
  campaign: Pick<Campaign, "restaurant_name" | "brand">,
  logoUri: string | null,
  size: { w: number; h: number } = { w: 1080, h: 1350 }
): string {
  const brand = campaign.brand;
  const primary = brand.primary_color || "#f75410";
  const fg = brand.text_on_primary === "dark" ? "#141210" : "#ffffff";
  const fgMuted = brand.text_on_primary === "dark" ? "rgba(20,18,16,0.66)" : "rgba(255,255,255,0.74)";
  const chipBg = brand.text_on_primary === "dark" ? "rgba(20,18,16,0.08)" : "rgba(255,255,255,0.14)";
  const font = "'Geist','Inter','Helvetica Neue',Arial,sans-serif";
  const { w, h } = size;
  const dow = dowFull(day.date);
  const item = esc(day.item);
  const copy = esc(day.copy);
  const name = esc(campaign.restaurant_name);

  const logo = logoUri
    ? `<clipPath id="lc"><circle cx="96" cy="112" r="34"/></clipPath>
       <circle cx="96" cy="112" r="37" fill="${chipBg}"/>
       <image href="${logoUri}" x="62" y="78" width="68" height="68" clip-path="url(#lc)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="96" cy="112" r="37" fill="${chipBg}"/>
       <text x="96" y="124" font-family="${font}" font-size="34" font-weight="700" fill="${fg}" text-anchor="middle">${esc(
         name.slice(0, 1)
       )}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="1" stop-color="${darken(primary, 60)}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.8" cy="0.1" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>

  ${logo}
  <text x="150" y="98" font-family="${font}" font-size="34" font-weight="600" fill="${fg}">${name}</text>
  <text x="150" y="134" font-family="${font}" font-size="22" font-weight="500" fill="${fgMuted}">${esc(
    brand.voice_summary
  )}</text>

  <text x="80" y="${h * 0.42}" font-family="${font}" font-size="230" font-weight="800" fill="${fg}" letter-spacing="-8">${
    day.pct_off
  }%</text>
  <text x="88" y="${h * 0.42 + 74}" font-family="${font}" font-size="72" font-weight="700" fill="${fg}" letter-spacing="6">OFF</text>

  <text x="80" y="${h * 0.42 + 190}" font-family="${font}" font-size="64" font-weight="700" fill="${fg}">${item}</text>
  <text x="80" y="${h * 0.42 + 250}" font-family="${font}" font-size="30" font-weight="500" fill="${fgMuted}">${esc(
    dow
  )} · ${esc(day.discount_window)}</text>

  <rect x="76" y="${h - 260}" width="${w - 152}" height="2" fill="${chipBg}"/>
  <text x="80" y="${h - 200}" font-family="${font}" font-size="34" font-weight="500" fill="${fg}">“${copy}”</text>

  <g transform="translate(80, ${h - 96})">
    <rect x="0" y="-34" width="150" height="50" rx="25" fill="${chipBg}"/>
    <text x="26" y="0" font-family="${font}" font-size="26" font-weight="700" fill="${fg}">Got60</text>
    <circle cx="16" cy="-9" r="5" fill="${fg}"/>
  </g>
  <text x="${w - 80}" y="${h - 62}" font-family="${font}" font-size="24" font-weight="500" fill="${fgMuted}" text-anchor="end">${esc(
    formatShortDate(day.date)
  )} · 60-min flash</text>
</svg>`;
}

export async function renderCreativePng(
  day: CampaignDay,
  campaign: Campaign,
  size?: { w: number; h: number }
): Promise<Buffer> {
  const logoUri = await logoDataUri(campaign.brand.logo_url);
  const svg = buildCreativeSvg(day, campaign, logoUri, size);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
