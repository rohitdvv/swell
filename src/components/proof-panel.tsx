"use client";

import * as React from "react";
import { ShieldCheck, Upload, Loader2, FileSpreadsheet, LineChart, Receipt } from "lucide-react";
import { Card } from "@/components/ui";
import { toast } from "@/components/toaster";
import type { ProofReport } from "@/lib/proof";
import { compressForUpload } from "@/lib/compress-upload";
import { formatCompactCurrency, formatShortDate } from "@/lib/utils";

const VERDICT: Record<ProofReport["verdict"], { title: string; body: string; tone: string }> = {
  proven: {
    title: "Proven on your register",
    body: "Even the cautious end of the range is above zero: this campaign made money you would not otherwise have made.",
    tone: "var(--os-mint)",
  },
  promising: {
    title: "Promising — not conclusive yet",
    body: "Sales ran above what we expected without the campaign, but not by enough to rule out an ordinary good stretch. More days will settle it.",
    tone: "var(--os-amber)",
  },
  "no-lift": {
    title: "No measurable lift",
    body: "Sales tracked what we expected without the campaign. Worth changing the offers or windows next month — that's what this report is for.",
    tone: "var(--fg-muted)",
  },
  "too-early": {
    title: "Too early to call",
    body: "Upload again once the campaign has run at least a week — a few days of sales can't separate the campaign from noise.",
    tone: "var(--fg-muted)",
  },
};

function signed(n: number) {
  return `${n >= 0 ? "+" : "−"}${formatCompactCurrency(Math.abs(n))}`;
}

export function ProofPanel({
  slug,
  startDate,
  proof,
  editable,
  onProof,
}: {
  slug: string;
  startDate: string;
  proof: ProofReport | null;
  editable: boolean;
  onProof: (p: ProofReport) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", await compressForUpload(file));
      const res = await fetch(`/api/campaigns/${slug}/proof`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.proof) throw new Error(data.error || "Could not measure this file.");
      onProof(data.proof);
      toast("Measured against your register.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not measure this file.", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const uploader = editable && (
    <>
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button
        onClick={() => input.current?.click()}
        disabled={busy}
        className="inline-flex h-11 items-center gap-2 rounded px-5 text-[14px] font-semibold transition hover:brightness-110 disabled:opacity-60"
        style={{ background: "var(--os-amber)", color: "#FFFFFF" }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {proof ? "Re-measure with a newer export" : "Upload your POS export"}
      </button>
    </>
  );

  if (!proof) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="os-label">Proof</div>
        <h2 className="mt-2 font-display text-3xl leading-tight text-balance">
          Did it actually make money? Your register will tell us.
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-muted text-pretty">
          Any tool can write a promotion. Swell is the one that checks it. After the campaign runs, upload
          the same export you started with. We compare every campaign day against what your sales would
          have been without it — forecast from your history before{" "}
          {formatShortDate(startDate)} — and tell you, with an honest range, what the campaign earned.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            { icon: FileSpreadsheet, t: "Export as usual", d: "Toast or Square, any range covering the campaign — more history before it sharpens the read." },
            { icon: LineChart, t: "Counterfactual", d: "The model trained before the campaign predicts each day without it, with its calibrated uncertainty." },
            { icon: Receipt, t: "Dish-level check", d: "Units of each promo dish sold in its window, against the same weekday before." },
          ].map(({ icon: Icon, t, d }) => (
            <Card key={t} className="p-4">
              <Icon className="size-4" style={{ color: "var(--os-amber)" }} />
              <div className="mt-2 text-sm font-semibold">{t}</div>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">{d}</p>
            </Card>
          ))}
        </div>
        <div className="mt-7">
          {uploader || (
            <p className="text-sm text-fg-subtle">
              The campaign owner uploads results here once the campaign has run.
            </p>
          )}
        </div>
      </div>
    );
  }

  const v = VERDICT[proof.verdict];
  const max = Math.max(1, ...proof.daily.flatMap((d) => [d.actual, d.expected]));
  const wt = proof.window_totals;

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: v.tone }}>
              <ShieldCheck className="size-4" /> {v.title}
            </div>
            <div className="mt-2 font-display text-5xl leading-none" style={{ color: v.tone }}>
              {signed(proof.lift)}
            </div>
            <div className="mt-2 font-mono text-[11px] text-fg-muted">
              80% range {signed(proof.low80)} to {signed(proof.high80)} · {proof.days_covered} campaign days measured
            </div>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-fg-muted text-pretty">{v.body}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Stat label="Actual sales" value={formatCompactCurrency(proof.actual)} />
            <Stat label="Expected without it" value={formatCompactCurrency(proof.counterfactual)} />
            <Stat label="Swell projected" value={signed(proof.projected)} />
            {wt && <Stat label="Promo dishes in window" value={`${wt.sold} vs ${wt.usual} usual`} />}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-semibold">Each day: actual vs expected without the campaign</span>
          <span className="flex items-center gap-3 font-mono text-[10px] text-fg-subtle">
            <span className="flex items-center gap-1">
              <i className="inline-block size-2 rounded-sm" style={{ background: "var(--os-mint)" }} /> actual
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block size-2 rounded-sm border" style={{ borderColor: "var(--fg-subtle)" }} /> expected
            </span>
          </span>
        </div>
        <div className="flex h-40 items-end gap-[3px]">
          {proof.daily.map((d) => (
            <div key={d.date} className="relative flex h-full flex-1 items-end" title={`${formatShortDate(d.date)}: ${formatCompactCurrency(d.actual)} vs ${formatCompactCurrency(d.expected)} expected`}>
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-sm border"
                style={{ height: `${(d.expected / max) * 100}%`, borderColor: "var(--fg-subtle)" }}
              />
              <div
                className="relative w-full rounded-t-sm"
                style={{
                  height: `${(d.actual / max) * 100}%`,
                  background: d.actual >= d.expected ? "var(--os-mint)" : "var(--os-rust, #E4572E)",
                  opacity: 0.75,
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      {proof.windows.some((w) => w.usual != null) && (
        <Card className="p-5">
          <div className="mb-3 text-sm font-semibold">Promo dishes, inside their windows</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {proof.windows
              .filter((w) => w.usual != null)
              .map((w) => (
                <div key={w.date} className="flex items-center gap-3 rounded bg-surface-2 px-3 py-2 text-[12.5px]">
                  <span className="w-14 shrink-0 font-mono text-[11px] text-fg-subtle">{formatShortDate(w.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{w.item}</span>
                  <span className="font-mono tabular-nums">
                    {w.sold} <span className="text-fg-subtle">vs {w.usual}</span>
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {uploader}
        <p className="text-xs text-fg-subtle text-pretty">
          Measured {formatShortDate(proof.measured_at.slice(0, 10))}. The expected line comes from a model trained
          only on sales before the campaign; the range is its calibrated uncertainty, assuming day-to-day errors
          are independent.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-fg-subtle">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
