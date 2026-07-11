"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  TrendingUp,
  Ticket,
  Pencil,
  RefreshCw,
  Check,
  Zap,
  Store,
  Users,
  Clock,
  Info,
  Download,
  Cpu,
  CloudSun,
  MapPin,
  Megaphone,
  Copy,
  Plug,
} from "lucide-react";
import type {
  CampaignWithDays,
  CampaignDay,
  Daypart,
  AgentEvent,
  ContextSummary,
  DayWeather,
} from "@/lib/types";
import { DAYPARTS, DAYPART_WINDOWS } from "@/lib/types";
import {
  formatCompactCurrency,
  formatNumber,
  dowShort,
  formatShortDate,
  parseLocalDate,
  cn,
} from "@/lib/utils";
import { Button, Badge, Card, Field, Input, Textarea, Select, Spinner, Segmented } from "@/components/ui";
import { Modal } from "@/components/modal";
import { toast } from "@/components/toaster";
import { CampaignReport } from "@/components/campaign-report";
import { CampaignInsights } from "@/components/campaign-insights";
import { MoneyHeadline } from "@/components/projection-panel";
import { AssistantWidget } from "@/components/assistant-widget";

const DOW_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Never let a seasonal estimate read as if we know the weather that day. */
function weatherTitle(w: DayWeather): string {
  const base = `${w.condition} ${w.tempF}° / ${w.lowF}°`;
  return w.source === "seasonal"
    ? `${base} — seasonal average for this date (beyond the 16-day forecast), ${w.rainProb}% of recent years were wet`
    : `${base} — live forecast, ${w.rainProb}% chance of rain`;
}

const DAYPART_TONE: Record<Daypart, string> = {
  Breakfast: "#f59e0b",
  Lunch: "#10b981",
  Afternoon: "#3b82f6",
  Dinner: "#8b5cf6",
  "Late-Night": "#ec4899",
};

export function CampaignBoard({
  initial,
  editable = true,
  showActivate = true,
}: {
  initial: CampaignWithDays;
  editable?: boolean;
  /** Hidden on the public demo, where nothing may be mutated. */
  showActivate?: boolean;
}) {
  const [campaign] = React.useState(initial);
  const [days, setDays] = React.useState<CampaignDay[]>(initial.days);
  const [paused, setPaused] = React.useState(initial.paused);
  const [editing, setEditing] = React.useState<CampaignDay | null>(null);
  const [activating, setActivating] = React.useState(false);
  const [view, setView] = React.useState<
    "calendar" | "insights" | "posters" | "report" | "distribution"
  >("calendar");

  const brand = campaign.brand;
  const brandColor = brand?.primary_color || "#f75410";

  const totalRev = days.reduce((a, d) => a + d.projected_revenue, 0);
  const totalRed = days.reduce((a, d) => a + d.projected_redemptions, 0);
  const editedCount = days.filter((d) => d.edited).length;
  const liftPct =
    campaign.baseline_revenue > 0
      ? (totalRev / campaign.baseline_revenue) * 100
      : 0;

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

  // calendar leading offset
  const startDow = parseLocalDate(campaign.start_date).getDay();

  return (
    <div
      className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
      style={{ ["--brand" as string]: brandColor }}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* ---------- main ---------- */}
        <div className="order-2 lg:order-1">
          {/* the money question, answered before anything else */}
          <MoneyHeadline campaign={{ ...campaign, days }} />

          {/* strategy notes */}
          <Card className="mb-5 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
              <Sparkles className="size-4" style={{ color: brandColor }} />
              <span className="text-sm font-semibold">How the brain built this</span>
              <Badge tone="ember" className="ml-auto">
                {campaign.marketplace?.simulated
                  ? "Modeled demand"
                  : campaign.marketplace?.in_marketplace
                    ? "Two-sided read"
                    : "Sales-history read"}
              </Badge>
            </div>
            <ul className="divide-y divide-border">
              {campaign.strategy_notes.map((n, i) => (
                <li key={i} className="flex gap-3 px-5 py-3 text-sm text-fg-muted">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full"
                    style={{ background: brandColor }}
                  />
                  <span className="text-pretty">{n}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* view toolbar */}
          <div className="mb-4 flex items-center justify-between">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "calendar", label: "Calendar" },
                { value: "insights", label: "Insights" },
                { value: "report", label: "Report" },
                { value: "posters", label: "Posters" },
                { value: "distribution", label: "Distribution" },
              ]}
            />
            <span className="hidden text-xs text-fg-subtle sm:block">{days.length} auto-branded posters</span>
          </div>

          {view === "distribution" ? (
            <DistributionPanel campaign={campaign} days={days} brandColor={brandColor} />
          ) : view === "insights" ? (
            <CampaignInsights campaign={{ ...campaign, days }} />
          ) : view === "report" ? (
            <CampaignReport campaign={{ ...campaign, days }} />
          ) : view === "calendar" ? (
            <>
              {/* calendar — desktop */}
              <Card className="hidden overflow-hidden md:block">
                <div className="grid grid-cols-7 border-b border-border bg-surface-2">
                  {DOW_HEADERS.map((d) => (
                    <div
                      key={d}
                      className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-fg-subtle"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: startDow }).map((_, i) => (
                    <div key={`blank-${i}`} className="min-h-[128px] border-b border-r border-border bg-surface-2/40" />
                  ))}
                  {days.map((d, i) => (
                    <DayCell
                      key={d.id}
                      day={d}
                      index={i}
                      brandColor={brandColor}
                      editable={editable}
                      onClick={() => setEditing(d)}
                    />
                  ))}
                </div>
              </Card>

              {/* list — mobile */}
              <div className="space-y-2.5 md:hidden">
                {days.map((d) => (
                  <DayListItem
                    key={d.id}
                    day={d}
                    brandColor={brandColor}
                    editable={editable}
                    onClick={() => setEditing(d)}
                  />
                ))}
              </div>
            </>
          ) : (
            <PostersGrid days={days} editable={editable} onOpen={setEditing} />
          )}
        </div>

        {/* ---------- sidebar ---------- */}
        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card className="overflow-hidden">
              <div
                className="px-5 py-5 text-white"
                style={{
                  background: `linear-gradient(135deg, ${brandColor}, ${shade(brandColor, -40)})`,
                }}
              >
                <div className="flex items-center gap-2 text-xs font-medium opacity-90">
                  <TrendingUp className="size-3.5" />
                  Projected incremental revenue
                </div>
                <div className="mt-1 font-display text-5xl leading-none">
                  {formatCompactCurrency(totalRev)}
                </div>
                <div className="mt-2 text-xs opacity-80">
                  ≈ {liftPct.toFixed(1)}% lift over your {formatCompactCurrency(campaign.baseline_revenue)} run-rate
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
                <Stat icon={<Ticket className="size-4" />} label="Redemptions" value={formatNumber(totalRed)} />
                <Stat icon={<Zap className="size-4" />} label="Promo days" value={`${days.length}`} />
              </div>
            </Card>

            {/* activate */}
            {showActivate && (
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge tone={paused ? "muted" : "mint"}>
                    <span className={cn("size-1.5 rounded-full", paused ? "bg-fg-subtle" : "bg-mint-500 animate-pulse")} />
                    {paused ? "Paused" : "Live"}
                  </Badge>
                </div>
                <Button
                  onClick={activate}
                  loading={activating}
                  variant={paused ? "primary" : "secondary"}
                  className="w-full"
                  size="lg"
                >
                  {!activating && (paused ? <Zap className="size-4" /> : <Check className="size-4" />)}
                  {paused ? "Activate campaign" : "Campaign is live"}
                </Button>
                {editedCount > 0 && (
                  <p className="mt-2.5 text-center text-xs text-fg-subtle">
                    {editedCount} card{editedCount === 1 ? "" : "s"} hand-tuned
                  </p>
                )}
              </Card>
            )}

            {/* marketplace signal */}
            {campaign.marketplace && (
              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Store className="size-4" style={{ color: brandColor }} />
                  <span className="text-sm font-semibold">Marketplace signal</span>
                  {campaign.marketplace.simulated && (
                    <Badge tone="ember" className="ml-auto">simulated</Badge>
                  )}
                </div>
                <SignalRow
                  label="Organic demand"
                  value={`${Math.round((campaign.marketplace.organic_demand_index || 0) * 100)}/100`}
                />
                {campaign.marketplace.in_marketplace ? (
                  <>
                    <SignalRow
                      label={campaign.marketplace.simulated ? "Est. saves" : "In-app saves"}
                      value={`${campaign.marketplace.simulated ? "~" : ""}${formatNumber(campaign.marketplace.saves)}`}
                    />
                    <SignalRow
                      label={campaign.marketplace.simulated ? "Est. redemptions" : "Past redemptions"}
                      value={`${campaign.marketplace.simulated ? "~" : ""}${formatNumber(campaign.marketplace.past_redemptions)}`}
                    />
                    <SignalRow
                      label="Demand lift"
                      value={`×${campaign.marketplace.lift_factor.toFixed(2)}`}
                    />
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-muted">
                      <Users className="size-3.5 shrink-0" />
                      {campaign.marketplace.neighborhood.dominant_age_band} · median basket $
                      {campaign.marketplace.neighborhood.median_basket} · {campaign.marketplace.neighborhood.consumer_density} density (1mi)
                    </div>
                    {campaign.marketplace.simulated && (
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
            )}

            {campaign.context?.located && (
              <RealtimeContext context={campaign.context} brandColor={brandColor} />
            )}

            {campaign.agent_trace && campaign.agent_trace.length > 0 && (
              <AgentTrace trace={campaign.agent_trace} brandColor={brandColor} />
            )}
          </div>
        </div>
      </div>

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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-fg-subtle">{icon}<span className="text-xs">{label}</span></div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
    </div>
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

function DayCell({
  day,
  index,
  brandColor,
  editable,
  onClick,
}: {
  day: CampaignDay;
  index: number;
  brandColor: string;
  editable: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.012, 0.4) }}
      onClick={onClick}
      className="group relative flex min-h-[128px] flex-col border-b border-r border-border p-2.5 text-left transition hover:bg-surface-2 focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={{ ["--tw-ring-color" as string]: brandColor }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-semibold text-fg-subtle">
          {parseLocalDate(day.date).getDate()}
          {day.weather && (
            <span
              className={day.weather.source === "seasonal" ? "font-normal opacity-60" : "font-normal"}
              title={weatherTitle(day.weather)}
            >
              {day.weather.icon}
            </span>
          )}
        </span>
        <span
          className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white"
          style={{ background: brandColor }}
        >
          {day.pct_off}%
        </span>
      </div>
      <div className="mt-2 flex-1">
        <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-fg">{day.item}</div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-fg-subtle">
          <span
            className="size-1.5 rounded-full"
            style={{ background: DAYPART_TONE[day.daypart] }}
          />
          {day.daypart}
        </div>
        {day.event && (
          <div
            className="mt-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium"
            style={{ background: `${brandColor}1a`, color: brandColor }}
            title={day.event.name}
          >
            {day.event.type === "holiday" ? "🎉" : "🎫"} <span className="line-clamp-1">{day.event.name}</span>
          </div>
        )}
      </div>
      <div className="line-clamp-2 text-[11px] leading-tight text-fg-subtle">{day.copy}</div>
      {editable && (
        <span className="absolute right-2 top-2 hidden group-hover:block">
          <Pencil className="size-3 text-fg-subtle" />
        </span>
      )}
    </motion.button>
  );
}

function DayListItem({
  day,
  brandColor,
  editable,
  onClick,
}: {
  day: CampaignDay;
  brandColor: string;
  editable: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left shadow-soft active:scale-[0.99] transition"
    >
      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2">
        <span className="text-[10px] font-medium uppercase text-fg-subtle">{dowShort(day.date)}</span>
        <span className="text-base font-semibold leading-none">{parseLocalDate(day.date).getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{day.item}</span>
          <span
            className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white"
            style={{ background: brandColor }}
          >
            {day.pct_off}%
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
          <Clock className="size-3" />
          {day.daypart} · {day.discount_window}
          {day.weather && (
            <span className="ml-1" title={weatherTitle(day.weather)}>
              {day.weather.icon} {day.weather.tempF}°
              {day.weather.source === "seasonal" && (
                <span className="text-fg-subtle/70"> avg</span>
              )}
            </span>
          )}
          {day.event && (
            <span style={{ color: brandColor }}>· {day.event.type === "holiday" ? "🎉" : "🎫"} {day.event.name}</span>
          )}
        </div>
        <div className="mt-1 line-clamp-1 text-xs text-fg-muted">{day.copy}</div>
      </div>
      {editable && <Pencil className="size-3.5 shrink-0 text-fg-subtle" />}
    </button>
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
    <Modal open={!!day} onClose={onClose} title={title}>
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
  { key: "google", name: "Google Ads", color: "#4285F4", note: "Responsive Search + Display", formats: ["1.91x1", "1x1"] },
  { key: "meta", name: "Meta / Facebook", color: "#1877F2", note: "Feed + Reels", formats: ["1x1", "4x5", "1.91x1"] },
  { key: "instagram", name: "Instagram", color: "#E1306C", note: "Feed + Stories", formats: ["1x1", "4x5", "9x16"] },
  { key: "tiktok", name: "TikTok", color: "#111111", note: "In-feed", formats: ["9x16"] },
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

  function connect(channel: string) {
    toast(`${channel}: connect your ad account (OAuth) to auto-publish — pipeline is wired.`, "info");
  }
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
            <Button variant="secondary" size="sm" className="w-full" onClick={() => connect(ch.name)}>
              <Plug className="size-3.5" /> Connect &amp; auto-publish
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
        Live auto-posting to Google &amp; Meta activates once you connect your ad account — the
        creatives, targeting radius and daily budget split are prepared per day.
      </p>
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

function RealtimeContext({
  context,
  brandColor,
}: {
  context: ContextSummary;
  brandColor: string;
}) {
  const rows = [
    { label: "Live forecast", value: `${context.forecast_days} days · avg ${context.avg_temp_f}°` },
    ...(context.seasonal_days > 0
      ? [{ label: "Seasonal normals", value: `${context.seasonal_days} days (est.)` }]
      : []),
    { label: "Wet days", value: `${context.rain_days}` },
    { label: "Warm days", value: `${context.warm_days}` },
    { label: "Local event days", value: `${context.event_days}` },
  ];
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <CloudSun className="size-4" style={{ color: brandColor }} />
        <span className="text-sm font-semibold">Live conditions</span>
        <Badge tone="muted" className="ml-auto gap-1">
          <span className="size-1.5 rounded-full bg-mint-500 animate-pulse" /> real-time
        </Badge>
      </div>
      <div className="mb-2 flex items-center gap-1 text-xs text-fg-subtle">
        <MapPin className="size-3" />
        {context.location_label}
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between py-1 text-sm">
          <span className="text-fg-muted">{r.label}</span>
          <span className="font-medium tabular-nums">{r.value}</span>
        </div>
      ))}
      <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-subtle">
        Items, discounts &amp; copy adapt to each day&apos;s weather and nearby events.
        {context.seasonal_days > 0 && (
          <>
            {" "}
            Forecasts run out at 16 days, so later dates use the average weather for that calendar
            date over the past 5 years — an estimate, marked &ldquo;est.&rdquo;
          </>
        )}
      </p>
    </Card>
  );
}

function AgentTrace({ trace, brandColor }: { trace: AgentEvent[]; brandColor: string }) {
  const total = trace.reduce((a, e) => a + e.ms, 0);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Cpu className="size-4" style={{ color: brandColor }} />
        <span className="text-sm font-semibold">Agent activity</span>
        <Badge tone="muted" className="ml-auto">
          {trace.length} agents · {(total / 1000).toFixed(1)}s
        </Badge>
      </div>
      <ol className="space-y-2.5">
        {trace.map((e, i) => (
          <li key={i} className="relative pl-5">
            <span
              className="absolute left-0 top-1.5 size-2 rounded-full"
              style={{ background: brandColor }}
            />
            {i < trace.length - 1 && (
              <span className="absolute left-[3.5px] top-3.5 h-full w-px bg-border" />
            )}
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold">{e.agent}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-fg-subtle">{e.ms}ms</span>
            </div>
            <div className="text-[11px] text-fg-subtle">{e.role}</div>
            <div className="mt-0.5 text-[11px] text-fg-muted">{e.detail}</div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const r = clampByte(parseInt(h.slice(0, 2) || "f7", 16) + amt);
  const g = clampByte(parseInt(h.slice(2, 4) || "54", 16) + amt);
  const b = clampByte(parseInt(h.slice(4, 6) || "10", 16) + amt);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function clampByte(n: number) {
  return Math.max(0, Math.min(255, n));
}
