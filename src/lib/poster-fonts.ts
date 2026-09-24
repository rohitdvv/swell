import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ============================================================
// Fonts for server-rendered posters.
//
// sharp draws SVG <text> through librsvg → Pango → fontconfig, which looks
// for fonts on the host. Serverless hosts (Vercel) ship none, so every glyph
// renders as a "tofu" box. We bundle Geist (SIL OFL, assets/fonts/) and point
// fontconfig at it BEFORE the first render. Import this module before sharp.
//
// The bundled dir comes first; the host's own config is included after it as
// a fallback for scripts Geist doesn't cover.
// ============================================================

export const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

function configure(): void {
  if (process.env.SWELL_FONTCONFIG_READY) return;
  if (!fs.existsSync(FONT_DIR)) {
    console.warn(`[poster-fonts] ${FONT_DIR} missing — posters will use host fonts`);
    return;
  }
  const dir = path.join(os.tmpdir(), "swell-fontconfig");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "fonts.conf");
  // Tests set SWELL_FONTS_ISOLATED to prove the bundled fonts work with no host fonts at all.
  const host =
    process.env.SWELL_FONTS_ISOLATED === "1"
      ? ""
      : `<include ignore_missing="yes">/etc/fonts/fonts.conf</include>`;
  fs.writeFileSync(
    file,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONT_DIR}</dir>
  <cachedir>${path.join(dir, "cache")}</cachedir>
  ${host}
  <alias binding="strong"><family>sans-serif</family><prefer><family>Geist</family></prefer></alias>
</fontconfig>
`
  );
  process.env.FONTCONFIG_FILE = file;
  process.env.SWELL_FONTCONFIG_READY = "1";
}

configure();
