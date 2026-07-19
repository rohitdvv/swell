"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Pencil,
  RefreshCw,
  Check,
  Zap,
  Store,
  Users,
  Info,
  Download,
  Megaphone,
  Copy,
  Plug,
  CalendarPlus,
  Mail,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import type {
  CampaignWithDays,
  CampaignDay,
  Daypart,
  DayWeather,
} from "@/lib/types";
import { DAYPARTS, DAYPART_WINDOWS } from "@/lib/types";
import {
  formatCompactCurrency,
  formatNumber,
  dowShort,
  dowFull,
  formatShortDate,
  parseLocalDate,
  cn,
} from "@/lib/utils";
import Link from "next/link";
import { Button, Badge, Card, Field, Input, Textarea, Select, Spinner } from "@/components/ui";
import { Modal } from "@/components/modal";
import { toast } from "@/components/toaster";
import { CampaignIntelligence } from "@/components/campaign-insights";
import { validateProjection } from "@/lib/validate";
import { AssistantWidget } from "@/components/assistant-widget";
import { CopyLink } from "@/components/copy-link";
import { osClass } from "@/components/os-theme";
import { floorScript } from "@/lib/calendar";

/** Never let a seasonal estimate read as if we know the weather that day. */
function weatherTitle(w: DayWeather): string {
  const base = `${w.condition} ${w.tempF}° / ${w.lowF}°`;
  return w.source === "seasonal"
    ? `${base} — seasonal average for this date (beyond the 16-day forecast), ${w.rainProb}% of recent years were wet`
    : `${base} — live forecast, ${w.rainProb}% chance of rain`;
}


export function CampaignBoard({
  initial,
  editable = true,
  showActivate = true,
  share = false,
  notice,
  footer,
}: {
  initial: CampaignWithDays;
  editable?: boolean;
  /** Hidden on the public demo, where nothing may be mutated. */
  showActivate?: boolean;
  /** Show a copy-link Share button in the OS header (public artifact pages). */
  share?: boolean;
  /** A slim OS-styled ribbon under the header (e.g. the demo read-only note). */
  notice?: React.ReactNode;
  /** OS-styled page footer, rendered inside the dark skin so nothing clashes. */
  footer?: React.ReactNode;
}) {
  const [campaign] = React.useState(initial);
  const [days, setDays] = React.useState<CampaignDay[]>(initial.days);
  const [paused, setPaused] = React.useState(initial.paused);
  const [editing, setEditing] = React.useState<CampaignDay | null>(null);
  const [activating, setActivating] = React.useState(false);
  const [selIdx, setSelIdx] = React.useState(0);
  const [view, setView] = React.useState<
    "calendar" | "intelligence" | "posters" | "distribution"
  >("calendar");

  const brand = campaign.brand;
  const brandColor = brand?.primary_color || "#C24A22";

  const v = React.useMemo(() => validateProjection({ ...campaign, days }), [campaign, days]);
  const checksPassed = v.checks.filter((c) => c.ok).length;
  const projectedTotal = v.baseline + v.expected;
  const maxBar = Math.max(v.baseline, projectedTotal, 1);
  const ctx = campaign.context;
  const s = campaign.sales_summary;
  const sel = days[Math.min(selIdx, days.length - 1)] ?? null;

  function applyDayUpdate(updated: CampaignDay) {
    setDays((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  async function activate() {
    setActivating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.slug}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: paused ? "activate" : "pause" }),
      });
      const data = await res.json();
      if (data.campaign) {
        setPaused(data.campaign.paused);
        toast(
          data.campaign.paused ? "Campaign paused." : "Campaign activated — it's live.",
          data.campaign.paused ? "info" : "success"
        );
      }
    } catch {
      toast("Could not update campaign.", "error");
    } finally {
      setActivating(false);
    }
  }

  const TABS = [
    { key: "calendar", label: "Calendar" },
    { key: "intelligence", label: "Intelligence" },
    { key: "posters", label: "Posters" },
    { key: "distribution", label: "Distribution" },
  ] as const;

  return (
    <div className={osClass("min-h-screen")} style={{ ["--brand" as string]: brandColor }}>
      {/* ══ OS header ══ */}
      <header
        className="sticky top-0 z-40 flex h-[60px] items-center gap-4 border-b px-5 sm:px-10"
        style={{
          borderColor: "var(--os-line)",
          background: "rgba(10,12,11,0.85)",
          backdropFilter: "blur(14px)",
        }}
      >
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl">Swell</span>
          <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: "var(--os-amber)" }}>
            OS
          </span>
        </Link>
        <span className="os-label hidden md:block">
          /C/{campaign.restaurant_slug.toUpperCase()} · PUBLIC ARTIFACT
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em]"
            style={{ color: paused ? "var(--os-amber)" : "var(--os-mint)" }}
          >
            <span
              className={cn("size-1.5 rounded-full", !paused && "os-pulse")}
              style={{ background: paused ? "var(--os-amber)" : "var(--os-mint)" }}
            />
            {paused ? "PAUSED" : "LIVE"}
          </span>
          {share && <CopyLink label="Share" />}
          {showActivate && (
            <button
              onClick={activate}
              disabled={activating}
              className="flex h-[34px] items-center gap-1.5 rounded px-4 text-[12.5px] font-semibold transition hover:brightness-110 disabled:opacity-60"
              style={{ background: "var(--os-amber)", color: "#0A0C0B" }}
            >
              {activating ? (
                <Spinner className="size-3.5" />
              ) : paused ? (
                <Zap className="size-3.5" />
              ) : (
                <Check className="size-3.5" />
              )}
              {paused ? "Activate campaign" : "Campaign is live"}
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div
          className="border-b px-5 py-3 sm:px-10"
          style={{ borderColor: "var(--os-line)", background: "var(--surface)" }}
        >
          <div className="mx-auto max-w-[1180px]">{notice}</div>
        </div>
      )}

      {/* ══ Masthead ══ */}
      <section className="relative overflow-hidden border-b" style={{ borderColor: "var(--os-line)" }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(70% 80% at 85% 0%, ${brandColor}26 0%, transparent 55%)` }}
        />
        <div className="relative mx-auto grid max-w-[1180px] items-end gap-8 px-5 pb-8 pt-12 sm:px-10 lg:grid-cols-[1fr_380px] lg:gap-12">
          <div>
            <div className="flex items-center gap-3">
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-lg font-display text-2xl"
                style={{ background: brandColor, color: "#F4F1E8" }}
              >
                {(campaign.restaurant_name || "S")[0]}
              </div>
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--os-amber)" }}>
                  30-DAY CAMPAIGN · {campaign.month.toUpperCase()}
                </div>
                <h1 className="mt-0.5 font-display text-4xl leading-none tracking-tight sm:text-[44px]">
                  {campaign.restaurant_name}
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-[540px] text-[14.5px] leading-relaxed text-fg-muted text-pretty">
              {[ctx?.location_label || campaign.location, `Generated ${formatShortDate(campaign.created_at.slice(0, 10))}`]
                .filter(Boolean)
                .join(" · ")}{" "}
              by the 10-agent brain from {s.date_range?.days ?? 30} days of sales
              {ctx?.located
                ? `, a live ${ctx.forecast_days}-day forecast, and ${ctx.event_days} event day${ctx.event_days === 1 ? "" : "s"}`
                : ""}
              . Every number below carries its confidence.
            </p>
          </div>

          {/* the money question, first */}
          <div
            className="rounded-lg border p-5 sm:px-6"
            style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
          >
            <div className="os-label">The money question, first</div>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-[42px] leading-none" style={{ color: "var(--os-mint)" }}>
                +{formatCompactCurrency(v.expected)}
              </span>
              <span className="font-mono text-[11px] text-fg-muted">
                {formatCompactCurrency(v.low)}–{formatCompactCurrency(v.high)}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <span className="os-chip" style={{ background: "rgba(180,118,42,0.18)", color: "var(--os-amber)" }}>
                Confidence: {v.confidence}
              </span>
              <span className="os-chip" style={{ background: "rgba(127,209,174,0.12)", color: "var(--os-mint)" }}>
                {checksPassed}/{v.checks.length} checks
              </span>
            </div>
            <div className="mt-3.5 flex gap-3.5 border-t pt-3" style={{ borderColor: "var(--os-line)" }}>
              <MoneyBar label="Last 30 days" value={v.baseline} max={maxBar} mint={false} />
              <MoneyBar label="Projected next 30" value={projectedTotal} max={maxBar} mint />
            </div>
          </div>
        </div>

        {/* tabs */}
        <div className="mx-auto flex max-w-[1180px] gap-1 overflow-x-auto px-5 sm:px-10">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setView(tb.key)}
              className="whitespace-nowrap px-5 py-3 text-[13.5px] font-semibold transition hover:text-fg"
              style={{
                color: view === tb.key ? "var(--fg)" : "var(--fg-subtle)",
                borderBottom: `2px solid ${view === tb.key ? "var(--os-amber)" : "transparent"}`,
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </section>

      {/* ══ Tab content ══ */}
      <main className="mx-auto max-w-[1180px] px-5 pb-20 pt-8 sm:px-10">
        {view === "calendar" && (
          <div className="grid items-start gap-7 lg:grid-cols-[1fr_320px]">
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
            >
              {days.map((d, i) => (
                <OsDayCard key={d.id} day={d} active={i === selIdx} onSelect={() => setSelIdx(i)} />
              ))}
            </div>
            <div className="flex flex-col gap-5 lg:sticky lg:top-[76px]">
              <SelectedRail day={sel} editable={editable} onEdit={() => sel && setEditing(sel)} />
              <TraceCard campaign={campaign} />
              <OperatorTools campaign={{ ...campaign, days }} brandColor={brandColor} />
              <MarketplaceCard campaign={campaign} brandColor={brandColor} />
            </div>
          </div>
        )}

        {view === "intelligence" && <CampaignIntelligence campaign={{ ...campaign, days }} />}

        {view === "posters" && (
          <div>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-display text-2xl">Thirty posters. All unmistakably you.</span>
              <span className="os-label">
                Duotone {brandColor} · logo · caption · click to {editable ? "edit" : "view"}
              </span>
            </div>
            <PostersGrid days={days} editable={editable} onOpen={setEditing} />
            <div className="os-label mt-4">
              Each re-cut to 1:1 · 4:5 · 9:16 · 1.91:1 in the Distribution tab
            </div>
          </div>
        )}

        {view === "distribution" && (
          <DistributionPanel campaign={campaign} days={days} brandColor={brandColor} />
        )}
      </main>

      {footer && (
        <footer className="border-t" style={{ borderColor: "var(--os-line)" }}>
          {footer}
        </footer>
      )}

      <EditModal
        day={editing}
        brandColor={brandColor}
        onClose={() => setEditing(null)}
        onSaved={applyDayUpdate}
        editable={editable}
      />

      <AssistantWidget
        slug={campaign.slug}
        brandColor={brandColor}
        restaurantName={campaign.restaurant_name}
      />
    </div>
  );
}

/** Masthead mini-bar: 30-day totals drawn to scale. */
function MoneyBar({ label, value, max, mint }: { label: string; value: number; max: number; mint: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-fg-subtle">{label}</div>
      <div className="mt-0.5 font-display text-xl" style={mint ? { color: "var(--os-mint)" } : undefined}>
        {formatCompactCurrency(value)}
      </div>
      <div className="mt-1.5 h-[5px] rounded-[3px]" style={{ background: "rgba(237,232,220,0.12)" }}>
        <div
          className="h-full rounded-[3px]"
          style={{
            width: `${Math.max((value / max) * 100, 4)}%`,
            background: mint ? "var(--os-mint)" : "rgba(237,232,220,0.28)",
          }}
        />
      </div>
    </div>
  );
}

function shortWindow(win: string): string {
  return win.replace(/:00/g, "");
}

/** One compact day card in the artifact calendar. */
function OsDayCard({
  day,
  active,
  onSelect,
}: {
  day: CampaignDay;
  active: boolean;
  onSelect: () => void;
}) {
  const w = day.weather;
  const ev = day.event;
  const deep = day.pct_off >= 25;
  const icon = ev ? (ev.type === "holiday" ? "🎉" : "🎫") : (w?.icon ?? "·");
  return (
    <button
      onClick={onSelect}
      className="min-h-[108px] rounded-md border p-3 pb-3.5 text-left transition"
      style={{
        borderColor: active ? "var(--os-amber)" : ev ? "rgba(127,209,174,0.3)" : "var(--border)",
        background: active ? "rgba(232,163,61,0.07)" : "var(--surface)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9.5px] text-fg-subtle">
          {dowShort(day.date).toUpperCase()} {parseLocalDate(day.date).getDate()}
        </span>
        <span className="text-xs" title={w ? weatherTitle(w) : undefined}>{icon}</span>
      </div>
      <div className="mt-2 line-clamp-2 text-[12.5px] font-semibold leading-tight">{day.item}</div>
      <div
        className="mt-1 font-mono text-[10px]"
        style={{ color: ev ? "var(--os-mint)" : deep ? "var(--os-amber)" : "var(--fg-muted)" }}
      >
        -{day.pct_off}% · {shortWindow(day.discount_window)}
      </div>
      <div
        className="mt-1 truncate font-mono text-[9px] uppercase text-fg-subtle"
        title={ev ? ev.name : w ? weatherTitle(w) : undefined}
      >
        {ev ? ev.name : w ? `${w.tempF}° ${w.condition}${w.source === "seasonal" ? " est." : ""}` : "—"}
      </div>
    </button>
  );
}

/** The right-rail detail for the selected day — the comp's amber card. */
function SelectedRail({
  day,
  editable,
  onEdit,
}: {
  day: CampaignDay | null;
  editable: boolean;
  onEdit: () => void;
}) {
  if (!day) return null;
  const w = day.weather;
  const deep = day.pct_off >= 25;
  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "rgba(232,163,61,0.4)", background: "var(--surface)" }}
    >
      <div className="os-label" style={{ color: "var(--os-amber)" }}>
        Selected — {dowFull(day.date)} {parseLocalDate(day.date).getDate()}
      </div>
      <div className="mt-2.5 font-display text-[26px] leading-tight">{day.item}</div>
      <div
        className="mt-1.5 font-mono text-[11.5px]"
        style={{ color: deep ? "var(--os-amber)" : "var(--fg-muted)" }}
      >
        -{day.pct_off}% · {shortWindow(day.discount_window)}
      </div>
      <p className="mt-3 font-display text-[13.5px] italic leading-relaxed text-fg-muted">
        “{day.copy}”
      </p>
      <div
        className="mt-3.5 flex flex-col gap-1.5 border-t pt-3 font-mono text-[10.5px] uppercase text-fg-muted"
        style={{ borderColor: "var(--os-line)" }}
      >
        {w && (
          <span title={weatherTitle(w)}>
            {w.icon} {w.tempF}° {w.condition}
            {w.source === "seasonal" ? " · seasonal est." : ""}
          </span>
        )}
        {day.event && (
          <span style={{ color: "var(--os-mint)" }}>
            {day.event.type === "holiday" ? "🎉" : "🎫"} {day.event.name}
            {day.event.venue ? ` @ ${day.event.venue}` : ""}
          </span>
        )}
        {day.expected_covers > 0 && (
          <span>Prep hint: {formatNumber(day.expected_covers)} expected covers</span>
        )}
        {(day.context_note || day.rationale) && (
          <span className="normal-case text-fg-subtle">
            WHY: {day.context_note || day.rationale}
          </span>
        )}
      </div>
      {editable && (
        <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={onEdit}>
          <Pencil className="size-3.5" /> Edit this day
        </Button>
      )}
    </div>
  );
}

/** Live conditions + agent trace, as terse mono checkmarks (per the comp). */
function TraceCard({ campaign }: { campaign: CampaignWithDays }) {
  const ctx = campaign.context;
  const lines: string[] = [];
  if (ctx?.located) {
    lines.push(`location: ${ctx.location_label}`);
    lines.push(
      `weather: ${ctx.forecast_days}-day live forecast${ctx.seasonal_days ? ` · normals beyond` : ""} · ${ctx.rain_days} wet`
    );
    lines.push(`events: ${ctx.event_days} event day${ctx.event_days === 1 ? "" : "s"} in window`);
  }
  for (const t of (campaign.agent_trace ?? []).filter((t) =>
    ["Analyst Agent", "Copywriter Agent", "Creative Agent"].includes(t.agent)
  )) {
    lines.push(`${t.agent.replace(" Agent", "").toLowerCase()}: ${clampStr(t.detail, 56)}`);
  }
  if (lines.length === 0) return null;
  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="os-label">Live conditions · agent trace</div>
      <div className="mt-1 flex flex-col">
        {lines.map((l, i) => (
          <div key={i} className="mt-2.5 flex gap-2.5 font-mono text-[10.5px] leading-relaxed">
            <span style={{ color: "var(--os-mint)" }}>✓</span>
            <span className="min-w-0 text-fg-muted">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Marketplace demand signal — honestly tagged when simulated. */
function MarketplaceCard({
  campaign,
  brandColor,
}: {
  campaign: CampaignWithDays;
  brandColor: string;
}) {
  if (!campaign.marketplace) return null;
  const m = campaign.marketplace;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Store className="size-4" style={{ color: brandColor }} />
        <span className="text-sm font-semibold">Marketplace signal</span>
        {m.simulated && (
          <Badge tone="ember" className="ml-auto">
            simulated
          </Badge>
        )}
      </div>
      <SignalRow label="Organic demand" value={`${Math.round((m.organic_demand_index || 0) * 100)}/100`} />
      {m.in_marketplace ? (
        <>
          <SignalRow
            label={m.simulated ? "Est. saves" : "In-app saves"}
            value={`${m.simulated ? "~" : ""}${formatNumber(m.saves)}`}
          />
          <SignalRow
            label={m.simulated ? "Est. redemptions" : "Past redemptions"}
            value={`${m.simulated ? "~" : ""}${formatNumber(m.past_redemptions)}`}
          />
          <SignalRow label="Demand lift" value={`×${m.lift_factor.toFixed(2)}`} />
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-muted">
            <Users className="size-3.5 shrink-0" />
            {m.neighborhood.dominant_age_band} · median basket ${m.neighborhood.median_basket} ·{" "}
            {m.neighborhood.consumer_density} density (1mi)
          </div>
          {m.simulated && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-subtle">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              Modeled preview from neighborhood + sales. Live figures populate once the Swell
              consumer app is active in this market.
            </div>
          )}
        </>
      ) : (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-muted">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          Not yet in the Swell consumer marketplace — plan leans on sales history.
        </div>
      )}
    </Card>
  );
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function EditModal({
  day,
  brandColor,
  onClose,
  onSaved,
  editable,
}: {
  day: CampaignDay | null;
  brandColor: string;
  onClose: () => void;
  onSaved: (d: CampaignDay) => void;
  editable: boolean;
}) {
  const [item, setItem] = React.useState("");
  const [pct, setPct] = React.useState(20);
  const [daypart, setDaypart] = React.useState<Daypart>("Dinner");
  const [copy, setCopy] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [cacheBust, setCacheBust] = React.useState(0);

  React.useEffect(() => {
    if (day) {
      setItem(day.item);
      setPct(day.pct_off);
      setDaypart(day.daypart);
      setCopy(day.copy);
      setCacheBust(Date.now());
    }
  }, [day]);

  if (!day) return null;

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/campaign-days/${day!.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("save failed");
    return res.json();
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      const data = await patch({ item, pct_off: pct, daypart, regenerateCopy: true });
      setCopy(data.day.copy);
    } catch {
      toast("Could not regenerate copy.", "error");
    } finally {
      setRegenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const data = await patch({ item, pct_off: pct, daypart, copy });
      onSaved(data.day);
      setCacheBust(Date.now());
      toast("Saved.", "success");
      onClose();
    } catch {
      toast("Could not save changes.", "error");
    } finally {
      setSaving(false);
    }
  }

  const title = editable ? "Edit promotion" : "Promotion";

  return (
    <Modal open={!!day} onClose={onClose} title={title} className={osClass()}>
      <div className="p-5">
        {/* creative preview */}
        <div className="mb-5 overflow-hidden rounded-xl border border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${day.creative_url}?v=${cacheBust}`}
            alt="Creative preview"
            className="mx-auto max-h-64 w-auto"
          />
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <span className="font-medium text-fg">
            {dowShort(day.date)} · {formatShortDate(day.date)}
          </span>
          <span>·</span>
          <span>{DAYPART_WINDOWS[daypart]}</span>
          {day.weather && (
            <span
              className="rounded-full bg-surface-2 px-2 py-0.5 text-xs"
              title={weatherTitle(day.weather)}
            >
              {day.weather.icon} {day.weather.tempF}° {day.weather.condition}
              {day.weather.source === "seasonal" && (
                <span className="text-fg-subtle"> · est.</span>
              )}
            </span>
          )}
          {day.event && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: `${brandColor}1a`, color: brandColor }}
            >
              {day.event.type === "holiday" ? "🎉" : "🎫"} {day.event.name}
            </span>
          )}
        </div>

        {(day.context_note || day.expected_covers > 0) && (
          <div className="mb-4 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-xs text-fg-muted">
            {day.context_note && <div className="text-pretty">{day.context_note}</div>}
            {day.expected_covers > 0 && (
              <div className="mt-1 text-fg-subtle">
                Prep hint: ~{formatNumber(day.expected_covers)} covers expected this day
              </div>
            )}
          </div>
        )}

        {editable ? (
          <div className="space-y-4">
            <Field label="Featured item">
              <Input value={item} onChange={(e) => setItem(e.target.value)} />
            </Field>

            <Field label={`Discount — ${pct}% off`}>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="w-full accent-[var(--brand)]"
                style={{ ["--brand" as string]: brandColor }}
              />
            </Field>

            <Field label="Time window">
              <Select value={daypart} onChange={(e) => setDaypart(e.target.value as Daypart)}>
                {DAYPARTS.map((d) => (
                  <option key={d} value={d}>
                    {d} · {DAYPART_WINDOWS[d]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Marketing copy" hint={`${copy.length}/80 characters`}>
              <div className="relative">
                <Textarea
                  value={copy}
                  maxLength={90}
                  rows={2}
                  onChange={(e) => setCopy(e.target.value)}
                />
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-fg-muted hover:text-fg"
                >
                  {regenerating ? <Spinner className="size-3" /> : <RefreshCw className="size-3" />}
                  Regenerate
                </button>
              </div>
            </Field>

            <div className="flex gap-2 pt-1">
              <Button variant="ghost" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={save} loading={saving} className="flex-1">
                Save changes
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-lg font-semibold">{item}</div>
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg-muted">“{copy}”</p>
            <div className="text-xs text-fg-subtle">{day.rationale}</div>
          </div>
        )}

        {editable && day.rationale && (
          <div className="mt-4 flex gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-xs text-fg-subtle">
            <Sparkles className="size-3.5 shrink-0" style={{ color: brandColor }} />
            <span className="text-pretty">{day.rationale}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

const CHANNELS = [
  {
    key: "google",
    name: "Google Ads",
    color: "#4285F4",
    note: "Responsive Search + Display",
    formats: ["1.91x1", "1x1"],
    managerUrl: "https://ads.google.com/aw/campaigns/new",
    managerLabel: "Open Google Ads",
  },
  {
    key: "meta",
    name: "Meta / Facebook",
    color: "#1877F2",
    note: "Feed + Reels",
    formats: ["1x1", "4x5", "1.91x1"],
    managerUrl: "https://business.facebook.com/adsmanager/manage/campaigns",
    managerLabel: "Open Ads Manager",
  },
  {
    key: "instagram",
    name: "Instagram",
    color: "#E1306C",
    note: "Feed + Stories",
    formats: ["1x1", "4x5", "9x16"],
    managerUrl: "https://business.facebook.com/adsmanager/manage/campaigns",
    managerLabel: "Open Ads Manager",
  },
  {
    key: "tiktok",
    name: "TikTok",
    color: "#111111",
    note: "In-feed",
    formats: ["9x16"],
    managerUrl: "https://ads.tiktok.com/i18n/creation",
    managerLabel: "Open TikTok Ads",
  },
];

const FORMAT_LABEL: Record<string, string> = {
  "1x1": "Square 1:1",
  "4x5": "Portrait 4:5",
  "9x16": "Story 9:16",
  "1.91x1": "Landscape 1.91:1",
};

function clampStr(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function DistributionPanel({
  campaign,
  days,
  brandColor,
}: {
  campaign: CampaignWithDays;
  days: CampaignDay[];
  brandColor: string;
}) {
  const name = campaign.restaurant_name;
  const maxPct = Math.max(...days.map((d) => d.pct_off));
  const hero = [...days].sort((a, b) => b.projected_revenue - a.projected_revenue)[0] ?? days[0];
  const monthName = campaign.month.split(" ")[0];

  const googleHeadlines = [
    clampStr(`${maxPct}% Off at ${name}`, 30),
    clampStr(`${hero.item} Deal This Week`, 30),
    clampStr(`${monthName} Flash Deals`, 30),
  ];
  const googleDescriptions = [
    clampStr(`${days.length} days of flash deals at ${name} — up to ${maxPct}% off. Book your table.`, 90),
    clampStr(hero.copy, 90),
  ];
  const metaPrimary = clampStr(
    `This ${monthName} at ${name}: ${days.length} flash deals, up to ${maxPct}% off. ${hero.copy}`,
    125
  );

  const [publishing, setPublishing] = React.useState<(typeof CHANNELS)[number] | null>(null);

  function copyText(t: string) {
    navigator.clipboard.writeText(t);
    toast("Copied.", "success");
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ember-gradient text-white">
            <Megaphone className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Publish-ready ad kit</div>
            <p className="text-xs text-fg-muted text-pretty">
              Every day&apos;s poster is exported in each channel&apos;s required sizes with
              character-limited ad copy. Connect an ad account to auto-publish, or download and upload.
            </p>
          </div>
        </div>
      </Card>

      {/* channels */}
      <div className="grid gap-3 sm:grid-cols-2">
        {CHANNELS.map((ch) => (
          <Card key={ch.key} className="p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <div
                className="flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ background: ch.color }}
              >
                {ch.name[0]}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight">{ch.name}</div>
                <div className="text-[11px] text-fg-subtle">{ch.note}</div>
              </div>
              <Badge tone="muted" className="ml-auto">Not connected</Badge>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {ch.formats.map((f) => (
                <a
                  key={f}
                  href={`${hero.creative_url}?ar=${f}`}
                  download={`${campaign.restaurant_slug}-${ch.key}-${f}.png`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium text-fg-muted transition hover:text-fg"
                >
                  <Download className="size-3" /> {FORMAT_LABEL[f]}
                </a>
              ))}
            </div>
            <Button variant="secondary" size="sm" className="w-full" onClick={() => setPublishing(ch)}>
              <Plug className="size-3.5" /> Publish to {ch.name}
            </Button>
          </Card>
        ))}
      </div>

      {/* ad copy */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4" style={{ color: brandColor }} />
          <span className="text-sm font-semibold">Generated ad copy</span>
          <Badge tone="muted" className="ml-auto">within platform limits</Badge>
        </div>
        <CopyBlock label="Google — Headlines (≤30 chars)" lines={googleHeadlines} onCopy={copyText} />
        <CopyBlock label="Google — Descriptions (≤90 chars)" lines={googleDescriptions} onCopy={copyText} />
        <CopyBlock label="Meta / Instagram — Primary text" lines={[metaPrimary]} onCopy={copyText} />
      </Card>

      <p className="px-1 text-center text-xs text-fg-subtle text-pretty">
        One-click OAuth auto-posting requires your own Meta / Google ad accounts — until then,
        &quot;Publish&quot; walks you through a 2-minute manual upload with everything pre-made.
      </p>

      {/* Publish workflow — everything needed to go live on this channel NOW. */}
      <Modal open={!!publishing} onClose={() => setPublishing(null)} title={publishing ? `Publish to ${publishing.name}` : ""} className={osClass()}>
        {publishing && (
          <div className="space-y-4">
            <PublishStep n={1} title="Download the creatives (pre-sized)">
              <div className="flex flex-wrap gap-1.5">
                {publishing.formats.map((f) => (
                  <a
                    key={f}
                    href={`${hero.creative_url}${hero.creative_url.includes("?") ? "&" : "?"}ar=${f}`}
                    download={`${campaign.restaurant_slug}-${publishing.key}-${f}.png`}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-fg-muted transition hover:text-fg"
                  >
                    <Download className="size-3" /> {FORMAT_LABEL[f]}
                  </a>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-fg-subtle">
                Downloads today&apos;s hero creative — every other day&apos;s poster is on the Posters tab.
              </p>
            </PublishStep>

            <PublishStep n={2} title="Copy the ad text (already within limits)">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  copyText(
                    publishing.key === "google"
                      ? [...googleHeadlines, ...googleDescriptions].join("\n")
                      : metaPrimary
                  )
                }
              >
                <Copy className="size-3.5" /> Copy {publishing.key === "google" ? "headlines + descriptions" : "primary text"}
              </Button>
            </PublishStep>

            <PublishStep n={3} title={`Upload in ${publishing.name}`}>
              <a href={publishing.managerUrl} target="_blank" rel="noreferrer">
                <Button size="sm">
                  <Megaphone className="size-3.5" /> {publishing.managerLabel} →
                </Button>
              </a>
            </PublishStep>

            <p className="rounded-lg bg-surface-2 px-3 py-2 text-[11px] text-fg-subtle text-pretty">
              <span className="font-medium text-fg-muted">Why no one-click connect yet? </span>
              Auto-publishing through the {publishing.name} API requires your own approved developer
              app and ad account — credentials only you can create. The pipeline on Swell&apos;s side
              is built; this guided upload is the honest bridge until you connect them.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PublishStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ember-gradient text-xs font-bold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-sm font-medium">{title}</div>
        {children}
      </div>
    </div>
  );
}

function CopyBlock({
  label,
  lines,
  onCopy,
}: {
  label: string;
  lines: string[];
  onCopy: (t: string) => void;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <div
            key={i}
            className="group flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate">{l}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-fg-subtle">{l.length}</span>
            <button onClick={() => onCopy(l)} className="shrink-0 text-fg-subtle hover:text-fg" title="Copy">
              <Copy className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostersGrid({
  days,
  editable,
  onOpen,
}: {
  days: CampaignDay[];
  editable: boolean;
  onOpen: (d: CampaignDay) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {days.map((d, i) => (
        <PosterCard key={d.id} day={d} index={i} editable={editable} onOpen={() => onOpen(d)} />
      ))}
    </div>
  );
}

function PosterCard({
  day,
  index,
  editable,
  onOpen,
}: {
  day: CampaignDay;
  index: number;
  editable: boolean;
  onOpen: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.5) }}
      className="group relative overflow-hidden rounded-xl border border-border bg-surface-2 shadow-soft"
    >
      <button onClick={onOpen} className="block w-full" aria-label={`Edit ${day.item}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={day.creative_url}
          alt={`${day.item} — ${day.pct_off}% off`}
          loading="lazy"
          className="aspect-[4/5] w-full object-cover transition group-hover:scale-[1.02]"
        />
      </button>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2">
        <span className="rounded-md bg-black/45 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          {dowShort(day.date)} {parseLocalDate(day.date).getDate()}
        </span>
      </div>
      <a
        href={`${day.creative_url}?dl=1`}
        download={`${day.item.replace(/\s+/g, "-").toLowerCase()}-${day.date}.png`}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-2 right-2 hidden size-8 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 group-hover:flex"
        title="Download poster"
      >
        <Download className="size-4" />
      </a>
      {editable && (
        <span className="absolute bottom-2 left-2 hidden rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm group-hover:block">
          Tap to edit
        </span>
      )}
    </motion.div>
  );
}

/**
 * Operator toolkit: Monday Brief, calendar subscribe, and floor SMS for today.
 * This is the "shows up Monday morning" surface the product promise sells.
 */
function OperatorTools({
  campaign,
  brandColor,
}: {
  campaign: CampaignWithDays;
  brandColor: string;
}) {
  const todayIso = React.useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);
  const today =
    campaign.days.find((d) => d.date === todayIso) ||
    campaign.days.find((d) => d.date >= todayIso) ||
    campaign.days[0];

  async function copyFloor() {
    if (!today) return;
    try {
      await navigator.clipboard.writeText(floorScript(campaign, today));
      toast("Floor script copied — text it to the team.", "success");
    } catch {
      toast("Could not copy.", "error");
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="size-4" style={{ color: brandColor }} />
        <span className="text-sm font-semibold">Operator tools</span>
      </div>
      <div className="space-y-2">
        <a
          href={`/c/${campaign.slug}/brief`}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm transition hover:border-border-strong"
        >
          <Mail className="size-3.5 text-fg-subtle" />
          <span className="flex-1 font-medium">Monday Brief</span>
          <ExternalLink className="size-3.5 text-fg-subtle" />
        </a>
        <a
          href={`/api/campaigns/${campaign.slug}/calendar`}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm transition hover:border-border-strong"
        >
          <CalendarPlus className="size-3.5 text-fg-subtle" />
          <span className="flex-1 font-medium">Add to calendar</span>
          <span className="text-[10px] uppercase tracking-wide text-fg-subtle">.ics</span>
        </a>
        <button
          type="button"
          onClick={copyFloor}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-left text-sm transition hover:border-border-strong"
        >
          <MessageSquare className="size-3.5 text-fg-subtle" />
          <span className="flex-1 font-medium">Copy floor script</span>
          <Copy className="size-3.5 text-fg-subtle" />
        </button>
      </div>
      {today && (
        <p className="mt-3 text-xs text-fg-subtle">
          Floor script targets{" "}
          <strong className="text-fg-muted">
            {formatShortDate(today.date)} · {today.pct_off}% {today.item}
          </strong>
        </p>
      )}
    </Card>
  );
}
