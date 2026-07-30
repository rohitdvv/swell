"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { osClass, OS } from "@/components/os-theme";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      className={osClass("flex min-h-screen flex-col items-center justify-center px-6 text-center")}
      style={{ background: OS.bg }}
    >
      <div className="font-display text-xl">
        Swell <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: OS.amber }}>OS</span>
      </div>
      <div className="mt-8 font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.rust }}>
        SOMETHING BROKE
      </div>
      <h1 className="mt-3 font-display text-[clamp(36px,6vw,56px)] font-normal leading-none tracking-[-0.025em]">
        The kitchen hit a snag.
      </h1>
      <p className="mt-5 max-w-md text-[15px] leading-[1.6]" style={{ color: OS.muted }}>
        This one&apos;s on us. Try again, or head back to the home page.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex h-11 items-center gap-1.5 rounded px-6 text-[14px] font-semibold transition hover:brightness-110"
          style={{ background: OS.amber, color: OS.bg }}
        >
          <RotateCcw className="size-4" /> Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded border px-6 text-[14px]"
          style={{ borderColor: "rgba(237,232,220,0.2)", color: OS.fg }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
