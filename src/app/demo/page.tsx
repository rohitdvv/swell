import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CloudSun } from "lucide-react";
import { getDemoCampaign } from "@/lib/demo";
import { CampaignBoard } from "@/components/campaign-board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live demo",
  description:
    "A real 30-day Swell campaign — generated from real sales, live weather and local events. No signup.",
};

export default async function DemoPage() {
  const campaign = await getDemoCampaign();
  const ctx = campaign.context;

  // The demo is edge-to-edge in the Swell OS artifact skin — its read-only
  // note and CTA are OS-styled slots inside the board, so nothing clashes.
  const notice = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        className="os-chip shrink-0"
        style={{ background: "rgba(127,209,174,0.12)", color: "var(--os-mint)" }}
      >
        Read-only demo
      </span>
      <span className="min-w-0 flex-1 text-[12.5px] text-fg-muted">
        A real campaign, generated minutes ago — nothing here is mocked.
      </span>
      {ctx?.located && (
        <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-subtle lg:inline-flex">
          <CloudSun className="size-3.5" style={{ color: "var(--os-amber)" }} />
          {ctx.location_label} · {ctx.forecast_days}-day forecast
        </span>
      )}
      <Link
        href="/sign-up"
        className="inline-flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-semibold transition hover:brightness-110"
        style={{ background: "var(--os-amber)", color: "#0A0C0B" }}
      >
        Generate your own <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );

  const footer = (
    <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-3 px-5 py-14 text-center sm:px-10">
      <h2 className="font-display text-3xl">Run this on your own numbers.</h2>
      <p className="max-w-md text-sm text-fg-muted text-pretty">
        Upload a Toast or Square export and get your own 30 days in about ten seconds.
      </p>
      <Link
        href="/sign-up"
        className="mt-1 inline-flex h-12 items-center gap-2 rounded px-6 text-[15px] font-semibold transition hover:brightness-110"
        style={{ background: "var(--os-amber)", color: "#0A0C0B" }}
      >
        Get started free <ArrowRight className="size-4" />
      </Link>
    </div>
  );

  return (
    <CampaignBoard
      initial={campaign}
      editable={false}
      showActivate={false}
      notice={notice}
      footer={footer}
    />
  );
}
