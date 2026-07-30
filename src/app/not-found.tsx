import Link from "next/link";
import { osClass, OS } from "@/components/os-theme";

export default function NotFound() {
  return (
    <div
      className={osClass("flex min-h-screen flex-col items-center justify-center px-6 text-center")}
      style={{ background: OS.bg }}
    >
      <div className="font-display text-xl">
        Swell <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: OS.amber }}>OS</span>
      </div>
      <div className="mt-8 font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.amber }}>
        ERROR 404
      </div>
      <h1 className="mt-3 font-display text-[clamp(40px,7vw,64px)] font-normal leading-none tracking-[-0.025em]">
        This page isn&apos;t on the menu.
      </h1>
      <p className="mt-5 max-w-md text-[15px] leading-[1.6]" style={{ color: OS.muted }}>
        The link may be stale, or the campaign was regenerated at a new URL.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded px-6 text-[14px] font-semibold transition hover:brightness-110"
          style={{ background: OS.amber, color: OS.bg }}
        >
          Back to home
        </Link>
        <Link
          href="/demo"
          className="inline-flex h-11 items-center rounded border px-6 text-[14px]"
          style={{ borderColor: "rgba(237,232,220,0.2)", color: OS.fg }}
        >
          See a live campaign
        </Link>
      </div>
    </div>
  );
}
