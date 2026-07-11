import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { repo } from "@/lib/db";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui";
import { weekBriefText } from "@/lib/calendar";
import {
  formatCompactCurrency,
  formatNumber,
  formatShortDate,
  parseLocalDate,
  dowShort,
} from "@/lib/utils";
import { validateProjection } from "@/lib/validate";
import type { CampaignDay } from "@/lib/types";
import { BriefActions } from "./brief-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await repo.getCampaignBySlug(slug);
  if (!campaign) return { title: "Brief not found" };
  return {
    title: `Monday Brief — ${campaign.restaurant_name}`,
    description: `This week's offers for ${campaign.restaurant_name}, planned by Swell.`,
  };
}

/** Next 7 campaign days from today (or the first week if campaign starts later). */
function weekSlice(days: CampaignDay[]): CampaignDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  let start = days.findIndex((d) => d.date >= todayIso);
  if (start < 0) start = 0;
  return days.slice(start, start + 7);
}

export default async function MondayBriefPage({ params }: Props) {
  const { slug } = await params;
  const campaign = await repo.getCampaignBySlug(slug);
  if (!campaign) notFound();

  const brandColor = campaign.brand?.primary_color || "#f75410";
  const week = weekSlice(campaign.days);
  const weekRev = week.reduce((a, d) => a + d.projected_revenue, 0);
  const weekRed = week.reduce((a, d) => a + d.projected_redemptions, 0);
  const v = validateProjection(campaign);
  const plain = weekBriefText(campaign, week);
  const generatedAt = new Date().toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${brandColor}, ${brandColor}88)` }} />

      <header className="border-b border-border print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <BriefActions
              plainText={plain}
              calendarHref={`/api/campaigns/${campaign.slug}/calendar`}
              campaignHref={`/c/${campaign.slug}`}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Letterhead */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-fg-subtle">
            <span className="size-1.5 rounded-full" style={{ background: brandColor }} />
            Monday brief · operator only
          </div>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            {campaign.restaurant_name}
          </h1>
          <p className="mt-2 text-lg text-fg-muted">
            Your week is already planned. Weather checked. Events checked. Offers ready.
          </p>
          <p className="mt-1 text-sm text-fg-subtle">Generated {generatedAt}</p>
        </div>

        {/* Money strip */}
        <div
          className="mb-8 overflow-hidden rounded-2xl p-6 text-white shadow-ember"
          style={{
            background: `linear-gradient(135deg, ${brandColor}, #1a1611)`,
          }}
        >
          <div className="text-xs font-medium uppercase tracking-wide opacity-80">
            This week · projected incremental
          </div>
          <div className="mt-1 font-display text-5xl leading-none">{formatCompactCurrency(weekRev)}</div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm opacity-90">
            <span>~{formatNumber(weekRed)} redemptions</span>
            <span>
              Full month band {formatCompactCurrency(v.low)}–{formatCompactCurrency(v.high)}
            </span>
            <span className="capitalize">{v.confidence} confidence</span>
          </div>
          {campaign.marketplace?.simulated && (
            <div className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-xs">
              Demand multiplier is a <strong>modeled preview</strong> — not live marketplace data yet.
            </div>
          )}
        </div>

        {/* Day cards */}
        <ol className="space-y-3">
          {week.map((day, i) => (
            <li
              key={day.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-[var(--surface)] p-5 shadow-sm transition hover:border-border-strong"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ background: brandColor }}
                    >
                      {dowShort(day.date)}
                    </span>
                    <div>
                      <div className="text-sm font-semibold">
                        {formatShortDate(day.date)}
                        <span className="ml-2 font-normal text-fg-subtle">
                          {parseLocalDate(day.date).toLocaleDateString("en-US", { weekday: "long" })}
                        </span>
                      </div>
                      <div className="text-xs text-fg-subtle">{day.discount_window}</div>
                    </div>
                  </div>
                  <h2 className="mt-3 font-display text-2xl leading-tight">
                    {day.pct_off}% off {day.item}
                  </h2>
                  <p className="mt-1.5 text-sm text-fg-muted text-pretty">&ldquo;{day.copy}&rdquo;</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold tabular-nums">
                    {formatCompactCurrency(day.projected_revenue)}
                  </div>
                  <div className="text-xs text-fg-subtle">
                    ~{formatNumber(day.projected_redemptions)} redemptions
                  </div>
                  <div className="mt-1 text-xs text-fg-subtle">
                    Prep ~{formatNumber(day.expected_covers)} covers
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {day.event && (
                  <Badge tone="ember">
                    {day.event.type === "sports" ? "Game day" : day.event.type}: {day.event.name}
                    {day.event.venue ? ` @ ${day.event.venue}` : ""}
                  </Badge>
                )}
                {day.weather && (
                  <Badge tone={day.weather.source === "seasonal" ? "muted" : "mint"}>
                    {day.weather.icon} {day.weather.condition} {day.weather.tempF}°
                    {day.weather.source === "seasonal" ? " · est." : ""}
                  </Badge>
                )}
                <Badge tone="muted">{day.daypart}</Badge>
              </div>

              {day.context_note && (
                <p className="mt-3 border-t border-border pt-3 text-xs text-fg-subtle text-pretty">
                  Why: {day.context_note}
                </p>
              )}

              <span className="pointer-events-none absolute -right-2 -top-2 font-display text-7xl text-fg/[0.03]">
                {i + 1}
              </span>
            </li>
          ))}
        </ol>

        {/* Honesty footer */}
        <div className="mt-10 rounded-2xl border border-border bg-[var(--surface-2)] p-5 text-sm text-fg-muted">
          <p className="font-medium text-fg">How to read these numbers</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs sm:text-sm">
            <li>
              Revenue is a <strong>range</strong> with stated confidence — not a guarantee.
            </li>
            <li>
              Response rate and incrementality are <strong>assumed</strong> (sensitivity-tested). Sales
              history and weather are <strong>measured</strong>.
            </li>
            {campaign.marketplace?.simulated && (
              <li>
                Marketplace demand is a <strong>modeled preview</strong> until the consumer app is live.
              </li>
            )}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 print:hidden">
            <Link
              href={`/c/${campaign.slug}`}
              className="text-sm font-medium underline-offset-4 hover:underline"
              style={{ color: brandColor }}
            >
              Open full 30-day plan →
            </Link>
            <Link
              href={`/api/campaigns/${campaign.slug}/calendar`}
              className="text-sm font-medium text-fg-muted underline-offset-4 hover:underline"
            >
              Add to calendar (.ics)
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
