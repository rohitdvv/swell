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
} from "lucide-react";
import type { CampaignWithDays, CampaignDay, Daypart } from "@/lib/types";
import { DAYPARTS, DAYPART_WINDOWS } from "@/lib/types";
import {
  formatCurrency,
  formatCompactCurrency,
  formatNumber,
  dowShort,
  formatShortDate,
  parseLocalDate,
  cn,
} from "@/lib/utils";
import { Button, Badge, Card, Field, Input, Textarea, Select, Spinner } from "@/components/ui";
import { Modal } from "@/components/modal";
import { toast } from "@/components/toaster";

const DOW_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
}: {
  initial: CampaignWithDays;
  editable?: boolean;
}) {
  const [campaign, setCampaign] = React.useState(initial);
  const [days, setDays] = React.useState<CampaignDay[]>(initial.days);
  const [paused, setPaused] = React.useState(initial.paused);
  const [editing, setEditing] = React.useState<CampaignDay | null>(null);
  const [activating, setActivating] = React.useState(false);

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
          {/* strategy notes */}
          <Card className="mb-5 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
              <Sparkles className="size-4" style={{ color: brandColor }} />
              <span className="text-sm font-semibold">How the brain built this</span>
              <Badge tone="ember" className="ml-auto">
                {campaign.marketplace?.in_marketplace ? "Two-sided read" : "Sales-history read"}
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

            {/* marketplace signal */}
            {campaign.marketplace && (
              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Store className="size-4" style={{ color: brandColor }} />
                  <span className="text-sm font-semibold">Marketplace signal</span>
                </div>
                <SignalRow
                  label="Organic demand"
                  value={`${Math.round((campaign.marketplace.organic_demand_index || 0) * 100)}/100`}
                />
                {campaign.marketplace.in_marketplace ? (
                  <>
                    <SignalRow label="In-app saves" value={formatNumber(campaign.marketplace.saves)} />
                    <SignalRow label="Past redemptions" value={formatNumber(campaign.marketplace.past_redemptions)} />
                    <SignalRow
                      label="Demand lift"
                      value={`×${campaign.marketplace.lift_factor.toFixed(2)}`}
                    />
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-muted">
                      <Users className="size-3.5 shrink-0" />
                      {campaign.marketplace.neighborhood.dominant_age_band} · median basket $
                      {campaign.marketplace.neighborhood.median_basket} · {campaign.marketplace.neighborhood.consumer_density} density (1mi)
                    </div>
                  </>
                ) : (
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-muted">
                    <Info className="size-3.5 shrink-0 mt-0.5" />
                    Not yet in the Got60 consumer marketplace — plan leans on sales history.
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      <EditModal
        day={editing}
        campaignSlug={campaign.slug}
        brandColor={brandColor}
        onClose={() => setEditing(null)}
        onSaved={applyDayUpdate}
        editable={editable}
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
        <span className="text-xs font-semibold text-fg-subtle">{parseLocalDate(day.date).getDate()}</span>
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
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
          <Clock className="size-3" />
          {day.daypart} · {day.discount_window}
        </div>
        <div className="mt-1 line-clamp-1 text-xs text-fg-muted">{day.copy}</div>
      </div>
      {editable && <Pencil className="size-3.5 shrink-0 text-fg-subtle" />}
    </button>
  );
}

function EditModal({
  day,
  campaignSlug,
  brandColor,
  onClose,
  onSaved,
  editable,
}: {
  day: CampaignDay | null;
  campaignSlug: string;
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

        <div className="mb-2 flex items-center gap-2 text-sm text-fg-muted">
          <span className="font-medium text-fg">
            {dowShort(day.date)} · {formatShortDate(day.date)}
          </span>
          <span>·</span>
          <span>{DAYPART_WINDOWS[daypart]}</span>
        </div>

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
