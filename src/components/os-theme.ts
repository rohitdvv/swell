import { Newsreader, Schibsted_Grotesk, Spline_Sans_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

/**
 * Swell OS typography, from the Claude Design comps.
 * Shared by the landing page and the campaign artifact so both surfaces
 * speak one visual language from a single source of truth.
 */
export const osSerif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-os-serif",
});
export const osSans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-os-sans" });
export const osMono = Spline_Sans_Mono({ subsets: ["latin"], variable: "--font-os-mono" });

/** Palette + fonts for the OS skin — also passed to portalled modals. */
export function osClass(extra?: string) {
  return cn("swell-os", osSerif.variable, osSans.variable, osMono.variable, extra);
}

/**
 * Palette for inline styles. Each entry points at a `.swell-os` CSS token, so
 * the whole product re-skins from globals.css. (Never append hex alpha to
 * these — they are var() references, not hex colors.)
 */
export const OS = {
  bg: "var(--bg)",
  bgAlt: "var(--bg-subtle)",
  panel: "var(--surface)",
  fg: "var(--fg)",
  muted: "var(--fg-muted)",
  subtle: "var(--fg-subtle)",
  amber: "var(--os-amber)",
  amberBright: "var(--os-amber-bright)",
  mint: "var(--os-mint)",
  rust: "var(--os-rust)",
  line: "var(--os-line)",
  line2: "var(--border)",
  // A contrasting ink band for the money chapter on the landing page.
  paper: "#1C1917",
  paperCard: "#26221E",
  ink: "#FBF8F3",
  inkMuted: "#C9C2B8",
  inkSubtle: "#9A9288",
  bronze: "#F0A35E",
} as const;
