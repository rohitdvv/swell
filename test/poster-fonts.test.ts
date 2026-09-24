import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";

// Serverless hosts have no system fonts. Isolate fontconfig to ONLY the
// bundled fonts — exactly the production situation — before sharp loads.
vi.hoisted(() => {
  process.env.SWELL_FONTS_ISOLATED = "1";
});

const { FONT_DIR } = await import("@/lib/poster-fonts");
const sharp = (await import("sharp")).default;

async function render(text: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120">
    <rect width="100%" height="100%" fill="#000"/>
    <text x="20" y="80" font-family="'Geist','Inter',sans-serif" font-size="60" font-weight="800" fill="#fff">${text}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).raw().toBuffer();
}

describe("poster fonts", () => {
  it("ships Geist with the app and points fontconfig at it", () => {
    const files = fs.readdirSync(FONT_DIR);
    for (const w of ["Regular", "Medium", "SemiBold", "Bold", "Black"]) {
      expect(files).toContain(`Geist-${w}.ttf`);
    }
    const conf = fs.readFileSync(process.env.FONTCONFIG_FILE!, "utf8");
    expect(conf).toContain(`<dir>${FONT_DIR}</dir>`);
  });

  it("renders real glyphs with no host fonts (no tofu boxes)", async () => {
    // Tofu draws every character as the same box, so two different strings of
    // equal length rasterize identically. Real glyphs never do.
    const a = await render("ABCD 25%");
    const b = await render("WXYZ 40%");
    expect(a.equals(b)).toBe(false);
    // And something was actually drawn.
    expect(a.some((v, i) => i % 3 === 0 && v > 200)).toBe(true);
  });
});
