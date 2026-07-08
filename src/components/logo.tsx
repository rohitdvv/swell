import Link from "next/link";
import { cn } from "@/lib/utils";

/** The Swell mark — a rising wave / swell of demand. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="swellgrad" x1="2" y1="18" x2="22" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f75410" />
          <stop offset="1" stopColor="#ff3b6b" />
        </linearGradient>
      </defs>
      <path
        d="M2.6 15.2c2.3 0 2.9-4.4 5.5-4.4s3.1 4.4 5.4 4.4 2.9-6.2 5.5-6.2"
        stroke="url(#swellgrad)"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M2.6 20c2.3 0 2.9-3.1 5.5-3.1s3.1 3.1 5.4 3.1 2.9-3.7 5.5-3.7"
        stroke="url(#swellgrad)"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.42"
      />
    </svg>
  );
}

// Back-compat alias (older imports referenced the mark as `Flame`).
export const Flame = Mark;

export function Logo({
  className,
  href = "/",
  size = "md",
}: {
  className?: string;
  href?: string | null;
  size?: "sm" | "md";
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold tracking-tight", className)}>
      <Mark className={size === "sm" ? "size-5" : "size-6"} />
      <span className={size === "sm" ? "text-base" : "text-lg"}>Swell</span>
    </span>
  );
  if (href === null) return inner;
  return <Link href={href}>{inner}</Link>;
}
