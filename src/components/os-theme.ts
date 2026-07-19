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

/** Comp palette, for inline styles where a CSS var would be awkward. */
export const OS = {
  bg: "#0A0C0B",
  bgAlt: "#0D100E",
  panel: "#101312",
  fg: "#EDE8DC",
  muted: "#9A968A",
  subtle: "#6B685E",
  amber: "#E8A33D",
  amberBright: "#F2B655",
  mint: "#7FD1AE",
  rust: "#E4572E",
  line: "rgba(237,232,220,0.08)",
  line2: "rgba(237,232,220,0.12)",
  paper: "#F4F1E8",
  paperCard: "#FBF9F3",
  ink: "#191813",
  inkMuted: "#6B675C",
  inkSubtle: "#8A8578",
  bronze: "#B4762A",
} as const;
