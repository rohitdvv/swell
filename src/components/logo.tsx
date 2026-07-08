import Link from "next/link";
import { cn } from "@/lib/utils";

export function Flame({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="g60flame" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f75410" />
          <stop offset="1" stopColor="#ff3b6b" />
        </linearGradient>
      </defs>
      <path
        d="M13.5 2c.6 3.2-1.3 4.7-2.9 6.2C9 9.7 7.5 11.2 7.5 14a4.5 4.5 0 0 0 9 0c0-1.6-.6-2.9-1.3-4 .2 1 .1 2.2-.9 2.9.4-2.2-.7-4.4-2.2-5.6.9 2 .2 3.6-.8 4.6-.2-2.6 1-4.9 2-8.3C15.6 4 14.6 2.7 13.5 2Z"
        fill="url(#g60flame)"
      />
    </svg>
  );
}

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
      <Flame className={size === "sm" ? "size-5" : "size-6"} />
      <span className={size === "sm" ? "text-base" : "text-lg"}>
        Got<span className="text-ember-gradient">60</span>
      </span>
    </span>
  );
  if (href === null) return inner;
  return <Link href={href}>{inner}</Link>;
}
