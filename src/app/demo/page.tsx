import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Sparkles, CloudSun, Eye } from "lucide-react";
import { getDemoCampaign } from "@/lib/demo";
import { CampaignBoard } from "@/components/campaign-board";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui";

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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Logo />
          <Badge tone="ember" className="hidden sm:inline-flex">
            <Eye className="size-3" /> Live demo
          </Badge>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/pricing" className="hidden text-sm text-fg-muted hover:text-fg sm:block">
              Pricing
            </Link>
            <ThemeToggle />
            <Link
              href="/sign-up"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ember-gradient px-3.5 text-sm font-medium text-white shadow-ember transition hover:brightness-105"
            >
              Get started <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* explainer band — this is the demo's whole job */}
      <div className="border-b border-border bg-surface-2/50">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex-1">
              <h1 className="font-display text-2xl sm:text-3xl">
                This is a real campaign, generated minutes ago.
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-fg-muted text-pretty">
                <strong className="text-fg">{campaign.restaurant_name}</strong> uploaded 45 days of
                sales. Swell z-scored their slowest hours, pulled the{" "}
                <strong className="text-fg">live forecast</strong> for their block, and wrote 30 days
                of on-brand offers — each with its own poster. Nothing here is mocked. Click any day
                to see why the brain chose it.
              </p>
            </div>
            {ctx?.located && (
              <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-soft">
                <CloudSun className="size-5 text-ember-500" />
                <div className="text-xs">
                  <div className="font-semibold">{ctx.location_label}</div>
                  <div className="text-fg-subtle">
                    {ctx.forecast_days}-day live forecast
                    {ctx.seasonal_days > 0 && ` + ${ctx.seasonal_days} seasonal`} · avg{" "}
                    {ctx.avg_temp_f}° · {ctx.rain_days} wet days
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
            <Sparkles className="size-3.5 text-ember-500" />
            Read-only demo — editing, activating and publishing are enabled on your own account.
            <Link href="/sign-up" className="font-medium text-ember-600 hover:text-ember-700">
              Generate one from your sales →
            </Link>
          </div>
        </div>
      </div>

      <CampaignBoard initial={campaign} editable={false} showActivate={false} />

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 text-center">
          <h2 className="font-display text-3xl">Run this on your own numbers.</h2>
          <p className="max-w-md text-sm text-fg-muted text-pretty">
            Upload a Toast or Square export and get your own 30 days in about ten seconds.
          </p>
          <Link
            href="/sign-up"
            className="mt-2 inline-flex h-12 items-center gap-2 rounded-xl bg-ember-gradient px-6 text-[15px] font-medium text-white shadow-ember transition hover:brightness-105"
          >
            <Sparkles className="size-4" /> Get started free
          </Link>
        </div>
      </footer>
    </div>
  );
}
