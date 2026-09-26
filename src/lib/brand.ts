import "server-only";
import * as cheerio from "cheerio";
import sharp from "sharp";
import type { BrandKit } from "./types";
import { seededUnit } from "./utils";
import { safeFetch } from "./safe-fetch";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) SwellBot/1.0 Chrome/120 Safari/537.36";

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

function domainOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function titleCaseFromDomain(domain: string): string {
  const core = domain.split(".")[0].replace(/[-_]/g, " ");
  return core.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Every brand-kit fetch targets a URL the user typed, so it goes through the
 * SSRF-safe client (private IPs refused at connect time, redirects re-checked,
 * body capped at 3 MB). Returns a minimal Response-like shape for callers.
 */
async function fetchWithTimeout(
  url: string,
  ms = 8000
): Promise<{ ok: boolean; status: number; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }> {
  const r = await safeFetch(url, {
    timeoutMs: ms,
    maxBytes: 3 * 1024 * 1024,
    accept: "text/html,*/*",
    userAgent: UA,
  });
  return {
    ok: r.ok,
    status: r.status,
    text: async () => r.body.toString("utf8"),
    arrayBuffer: async () =>
      r.body.buffer.slice(r.body.byteOffset, r.body.byteOffset + r.body.byteLength) as ArrayBuffer,
  };
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")
  );
}

function shift(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) + amt;
  const g = parseInt(h.slice(2, 4), 16) + amt;
  const b = parseInt(h.slice(4, 6), 16) + amt;
  return toHex(r, g, b);
}

function colorFromDomain(domain: string): string {
  const hue = Math.floor(seededUnit(domain) * 360);
  // pleasant, saturated but not neon
  return hslToHex(hue, 62, 46);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

function validHex(v: string | undefined | null): string | null {
  if (!v) return null;
  const m = v.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex.toLowerCase()}`;
}

/** Sites ship "null" and "undefined" as literal meta content — treat as missing. */
function clean(v: string | undefined | null): string | null {
  const t = v?.replace(/\s+/g, " ").trim();
  return t && !/^(null|undefined|none|n\/a)$/i.test(t) ? t : null;
}

/** A usable brand colour: not white, black or grey (a white "brand" makes white posters). */
export function brandable(hex: string | null): string | null {
  if (!hex) return null;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (l > 0.9 || l < 0.08 || sat < 0.18) return null;
  return hex;
}

const PITCH = /^(?:the\s+)?(?:best|top[- ]rated|#1|voted|award[- ]winning|welcome|official|home\b|order online|menu\b)/i;

/** Is `needle` a subsequence of `hay`? ("hpbng" in "hydeparkbarandgrill") */
function subsequence(needle: string, hay: string): boolean {
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return needle.length > 0 && i === needle.length;
}

/**
 * The venue's name from a page title written for search engines:
 *   "Best American Restaurant in Austin | Hyde Park Bar & Grill" → "Hyde Park Bar & Grill"
 *   "Moonshine Patio Bar & Grill Best Comfort Food in Austin Texas" → "Moonshine Patio Bar & Grill"
 * Segments that spell the domain win; pitch phrases lose.
 */
export function nameFromTitle(title: string, domain = ""): string | null {
  const host = domain.replace(/^www\./, "").split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const segments = title
    .split(/\s[|\-–—:·•]\s|\s[|–—·•]|[|–—·•]\s/)
    .map((seg) => clean(seg.split(/\s+(?:best|top[- ]rated|#1|voted|award[- ]winning|official site)\b/i)[0].replace(/^welcome to\s+/i, "")))
    .filter((seg): seg is string => !!seg && seg.length <= 60);
  if (!segments.length) return null;
  const score = (seg: string) =>
    (host && subsequence(host, seg.toLowerCase().replace(/[^a-z0-9]/g, "")) ? 2 : 0) - (PITCH.test(seg) ? 3 : 0);
  const best = [...segments].sort((x, y) => score(y) - score(x))[0];
  return PITCH.test(best) ? null : best;
}

async function dominantColorFromImage(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { dominant } = await sharp(buf).stats();
    // Skip near-white/near-black logos (transparent bg edges) — nudge if flat.
    // Skip white/black/grey logos (transparent edges, monochrome marks).
    return brandable(toHex(dominant.r, dominant.g, dominant.b));
  } catch {
    return null;
  }
}

// ---- voice analysis (free, local) --------------------------
const TONE_LEXICON: Record<string, string[]> = {
  "warm & rustic": ["rustic", "family", "tradition", "homemade", "hearth", "cozy", "authentic", "wood", "grandma", "nonna", "farm", "seasonal", "handcrafted", "comfort"],
  "refined & upscale": ["refined", "elegant", "curated", "chef", "tasting", "sommelier", "exquisite", "sophisticated", "artistry", "michelin", "fine", "signature", "reserve"],
  "playful & bold": ["bold", "fun", "vibrant", "spicy", "loud", "party", "wild", "craveable", "legendary", "obsessed", "epic", "stacked"],
  "fresh & wholesome": ["fresh", "organic", "local", "healthy", "clean", "green", "sustainable", "garden", "plant", "wholesome", "nutritious", "vibrant"],
  "urban & modern": ["modern", "urban", "minimal", "neighborhood", "craft", "small-batch", "roasted", "curators", "design", "industrial"],
};

const STOP = new Set(
  "the a an and or of to in on for with your our we you is are be at by from as it this that these those we're our".split(
    " "
  )
);

function analyzeVoice(text: string, name: string): {
  summary: string;
  keywords: string[];
  vector: number[];
} {
  const clean = text.toLowerCase().replace(/\s+/g, " ").slice(0, 8000);
  const words = clean.match(/[a-z][a-z'-]{2,}/g) ?? [];

  // tone scoring
  const scores: Record<string, number> = {};
  for (const [tone, lex] of Object.entries(TONE_LEXICON)) {
    scores[tone] = lex.reduce((acc, w) => acc + (clean.includes(w) ? 1 : 0), 0);
  }
  const best =
    Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[1] > 0
      ? Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]
      : "warm & inviting";

  // keyword frequency (skip stopwords + the restaurant name)
  const nameWords = new Set(name.toLowerCase().split(/\s+/));
  const freq = new Map<string, number>();
  for (const w of words) {
    if (STOP.has(w) || nameWords.has(w) || w.length < 4) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  // free "embedding": 64-dim hashed term-frequency vector (L2 normalized)
  const dims = 64;
  const vec = new Array(dims).fill(0);
  for (const w of words) {
    if (STOP.has(w)) continue;
    let h = 2166136261;
    for (let i = 0; i < w.length; i++) {
      h ^= w.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    vec[(h >>> 0) % dims] += 1;
  }
  const mag = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
  const vector = vec.map((v) => Math.round((v / mag) * 1000) / 1000);

  return { summary: best, keywords, vector };
}

// ---- main --------------------------------------------------
export async function extractBrandKit(rawUrl: string): Promise<BrandKit> {
  const url = normalizeUrl(rawUrl);
  const domain = domainOf(url);
  const notes: string[] = [];
  let html = "";
  try {
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      html = await res.text();
    } else {
      notes.push(`Site returned ${res.status}; used domain-derived defaults.`);
    }
  } catch {
    notes.push("Could not reach the site; used domain-derived defaults.");
  }

  const $ = cheerio.load(html || "<html></html>");
  const abs = (href: string | undefined): string | null => {
    if (!href) return null;
    try {
      return new URL(href, url).href;
    } catch {
      return null;
    }
  };

  // name
  const name =
    nameFromTitle(clean($('meta[property="og:site_name"]').attr("content")) ?? "", domain) ||
    nameFromTitle($("title").first().text(), domain) ||
    nameFromTitle(clean($('meta[property="og:title"]').attr("content")) ?? "", domain) ||
    titleCaseFromDomain(domain);

  // logo candidates
  const logoCandidates = [
    $('link[rel="icon"][type="image/svg+xml"]').attr("href"),
    $('link[rel="apple-touch-icon"]').attr("href"),
    $('link[rel="icon"]').attr("href"),
    $('link[rel="shortcut icon"]').attr("href"),
    $('meta[property="og:image"]').attr("content"),
    "/favicon.ico",
  ]
    .map(abs)
    .filter(Boolean) as string[];
  const logo_url = logoCandidates[0] ?? null;

  // color: theme-color meta → CSS custom props → logo dominant → domain hash
  let primary = brandable(validHex($('meta[name="theme-color"]').attr("content")));
  if (primary) notes.push("Primary color from <meta theme-color>.");

  if (!primary) {
    const styleText = $("style").text() + " " + ($('[style]').attr("style") ?? "");
    const varMatch = styleText.match(
      /--(?:primary|brand|accent|color-primary|main)[^:;]*:\s*(#[0-9a-f]{3,6})/i
    );
    // Otherwise the site's most-used real colour (skipping whites, blacks and greys).
    const counts = new Map<string, number>();
    for (const m of styleText.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []) {
      const hex = brandable(validHex(m));
      if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    primary = brandable(validHex(varMatch?.[1])) || common;
    if (primary) notes.push("Primary color inferred from site CSS.");
  }

  if (!primary && logo_url) {
    const fromLogo = await dominantColorFromImage(logo_url);
    if (fromLogo) {
      primary = fromLogo;
      notes.push("Primary color extracted from logo (dominant color).");
    }
  }

  if (!primary) {
    primary = colorFromDomain(domain);
    notes.push("Primary color synthesized from domain.");
  }

  const text_on_primary: "light" | "dark" =
    luminance(primary) > 0.5 ? "dark" : "light";
  const secondary =
    luminance(primary) > 0.5 ? shift(primary, -40) : shift(primary, 40);

  // typography
  let font_family = "Inter, system-ui, sans-serif";
  const gfont = $('link[href*="fonts.googleapis.com"]').attr("href");
  if (gfont) {
    const fam = gfont.match(/family=([^:&]+)/);
    if (fam) {
      font_family = `${decodeURIComponent(fam[1].replace(/\+/g, " "))}, sans-serif`;
      notes.push("Typography detected from Google Fonts link.");
    }
  } else {
    const ff = ($("style").text() + " " + ($("body").attr("style") ?? "")).match(
      /font-family:\s*([^;"}]+)/i
    );
    if (ff) {
      font_family = ff[1].trim().replace(/['"]/g, "");
      notes.push("Typography inferred from site CSS.");
    }
  }

  // imagery — hero / gallery photos for poster backgrounds
  const imageSet = new Set<string>();
  const ogImg = abs($('meta[property="og:image"]').attr("content"));
  if (ogImg) imageSet.add(ogImg);
  $("img").each((_, el) => {
    const src =
      $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
    const resolved = abs(src ?? undefined);
    if (!resolved) return;
    if (/\.svg(\?|$)/i.test(resolved)) return; // skip icons/logos
    if (/(logo|icon|sprite|favicon|avatar|badge|pixel|1x1)/i.test(resolved)) return;
    const w = parseInt($(el).attr("width") || "0", 10);
    const h = parseInt($(el).attr("height") || "0", 10);
    if ((w && w < 200) || (h && h < 200)) return; // skip tiny images
    imageSet.add(resolved);
  });
  const image_urls = [...imageSet].slice(0, 12);
  if (image_urls.length) notes.push(`Collected ${image_urls.length} site images for poster backgrounds.`);

  // tagline
  const tagline =
    clean($('meta[property="og:description"]').attr("content")) ||
    clean($('meta[name="description"]').attr("content")) ||
    clean($("h1").first().text()) ||
    clean($("h2").first().text()) ||
    null;

  // voice: hero + about copy
  const heroText = [
    $("h1").text(),
    $("h2").slice(0, 3).text(),
    $('meta[name="description"]').attr("content") ?? "",
    $("p").slice(0, 8).text(),
  ].join(" ");
  const voice = analyzeVoice(heroText || tagline || name, name);

  return {
    source_url: url,
    domain,
    name,
    logo_url,
    image_urls,
    primary_color: primary,
    secondary_color: secondary,
    text_on_primary,
    font_family,
    tagline: tagline ? tagline.slice(0, 160) : null,
    voice_summary: voice.summary,
    voice_keywords: voice.keywords,
    voice_vector_dims: voice.vector.length,
    extraction_notes: notes,
  };
}

/** Neutral brand kit when no URL is provided. */
export function neutralBrandKit(name: string): BrandKit {
  const primary = "#f75410";
  return {
    source_url: "",
    domain: "",
    name,
    logo_url: null,
    image_urls: [],
    primary_color: primary,
    secondary_color: "#ff3b6b",
    text_on_primary: "light",
    font_family: "Inter, system-ui, sans-serif",
    tagline: null,
    voice_summary: "warm & inviting",
    voice_keywords: [],
    voice_vector_dims: 64,
    extraction_notes: ["No website provided — used neutral brand defaults."],
  };
}
