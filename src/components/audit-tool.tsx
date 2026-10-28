"use client";

import * as React from "react";
import Link from "next/link";
import { Upload, Loader2, FileSpreadsheet, ShieldCheck, Users, Sparkles, ArrowRight, Check } from "lucide-react";
import { compressForUpload } from "@/lib/compress-upload";
import { formatCompactCurrency } from "@/lib/utils";
import type { MoneyReport, CampaignCheck } from "@/lib/audit";

type Mode = "find" | "check";
type Venue = { name: string | null; location: string | null };
type Result =
  | { mode: "find"; venue: Venue; report: MoneyReport }
  | { mode: "check"; venue: Venue; report: CampaignCheck };

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${formatCompactCurrency(Math.abs(n))}`;

export function AuditTool() {
  const [mode, setMode] = React.useState<Mode>("find");
  const [file, setFile] = React.useState<File | null>(null);
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [spend, setSpend] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  async function run(f: File | null = file, overrides: { start?: string; mode?: Mode; spend?: string } = {}) {
    if (!f) return;
    const m = overrides.mode ?? mode;
    const s = overrides.start ?? start;
    const sp = overrides.spend ?? spend;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", await compressForUpload(f));
      fd.append("mode", m);
      if (m === "check") {
        fd.append("start", s);
        if (end) fd.append("end", end);
        if (sp) fd.append("spend", sp);
      }
      const res = await fetch("/api/audit", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({ error: res.status === 413 ? "That file is too large." : "Something went wrong." }));
      if (!res.ok) {
        if (data.suggestedStart && !s) setStart(data.suggestedStart);
        throw new Error(data.error);
      }
      if (data.mode === "find" && data.suggestedStart && !start) setStart(data.suggestedStart);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function trySample() {
    const scenario = mode === "check" ? "?scenario=campaign" : "";
    const res = await fetch(`/api/sample-csv${scenario}`);
    const blob = await res.blob();
    const f = new File([blob], mode === "check" ? "sample-restaurant-after-campaign.csv" : "sample-restaurant.csv", { type: "text/csv" });
    const s = res.headers.get("x-campaign-start") ?? "";
    setFile(f);
    const sp = spend || (mode === "check" ? "499" : "");
    if (mode === "check") {
      setStart(s);
      setSpend(sp);
    }
    await run(f, { start: s, spend: sp });
  }

  return (
    <div className="mt-10">
      {/* mode */}
      <div className="inline-flex rounded-lg border border-border bg-surface p-1">
        {(
          [
            ["find", "Find my money"],
            ["check", "Did my marketing work?"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setResult(null);
              setError(null);
            }}
            className="rounded-md px-4 py-2 text-[14px] font-semibold transition"
            style={mode === m ? { background: "var(--os-amber)", color: "#fff" } : { color: "var(--fg-muted)" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* upload */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) {
              setFile(f);
              if (mode === "find") run(f);
            }
          }}
          className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface p-6 text-center"
        >
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && mode === "find") run(f);
            }}
          />
          {busy ? (
            <div className="flex items-center gap-2 text-fg-muted">
              <Loader2 className="size-5 animate-spin" /> Reading every order…
            </div>
          ) : file ? (
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="size-4" style={{ color: "var(--os-amber)" }} />
              <span className="font-medium">{file.name}</span>
              <button onClick={() => input.current?.click()} className="text-fg-subtle underline">
                change
              </button>
            </div>
          ) : (
            <>
              <Upload className="size-6 text-fg-subtle" />
              <button
                onClick={() => input.current?.click()}
                className="mt-3 rounded-md px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110"
                style={{ background: "var(--os-amber)" }}
              >
                Upload your sales export
              </button>
              <p className="mt-2 text-xs text-fg-subtle">CSV or Excel · Toast, Square, Clover · 30–90 days works best</p>
            </>
          )}
          {!busy && (
            <button onClick={trySample} className="mt-4 text-[13px] font-medium underline" style={{ color: "var(--os-amber)" }}>
              No export handy? Try a sample restaurant
            </button>
          )}
        </div>

        {/* check-mode inputs / reassurance */}
        <div className="rounded-xl border border-border bg-surface p-5 text-sm">
          {mode === "check" ? (
            <div className="space-y-3">
              <Field label="Campaign started on">
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded border border-border bg-bg px-2 py-1.5" />
              </Field>
              <Field label="…and ended on (optional)">
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded border border-border bg-bg px-2 py-1.5" />
              </Field>
              <Field label="What it costs you a month (optional)">
                <input
                  inputMode="decimal"
                  placeholder="e.g. 499"
                  value={spend}
                  onChange={(e) => setSpend(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full rounded border border-border bg-bg px-2 py-1.5"
                />
              </Field>
              <button
                disabled={!file || !start || busy}
                onClick={() => run()}
                className="mt-1 w-full rounded-md py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                style={{ background: "var(--os-amber)" }}
              >
                Check it
              </button>
              <p className="text-xs text-fg-subtle">
                Works for any campaign — a POS add-on, an agency, a flyer, a happy hour. Needs 14+ days of sales before it
                started.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5 text-[13.5px] text-fg-muted">
              {[
                "Labor hours a same-every-day schedule wastes",
                "Profit in your slowest hours",
                "A forecast tested against what it never saw",
                "Your file is never stored",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" style={{ color: "var(--os-mint)" }} />
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-sm" style={{ color: "var(--os-rust)" }}>{error}</p>}

      {result?.mode === "find" && <MoneyResult r={result.report} venue={result.venue} />}
      {result?.mode === "check" && <CheckResult r={result.report} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      {children}
    </label>
  );
}

function MoneyResult({ r, venue }: { r: MoneyReport; venue: Venue }) {
  return (
    <section className="mt-10 space-y-5">
      <div className="rounded-xl border-2 p-7" style={{ borderColor: "var(--os-mint)", background: "var(--surface)" }}>
        <div className="text-sm font-semibold text-fg-muted">
          {venue.name ? `${venue.name}${venue.location ? ` · ${venue.location}` : ""}` : "Your restaurant"} · {r.days} days of sales
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <span className="font-display text-[clamp(44px,7vw,72px)] leading-none" style={{ color: "var(--os-mint)" }}>
            {formatCompactCurrency(r.totalPerMonth)}
          </span>
          <span className="text-[17px] text-fg-muted">a month in profit you could be keeping</span>
        </div>
        <p className="mt-3 text-[15px] text-fg-muted">
          That&apos;s about <strong className="text-fg">{formatCompactCurrency(r.perYear)} a year</strong> — roughly{" "}
          {Math.round(r.shareOfTypicalProfit * 100)}% of what a typical restaurant with your sales keeps in a year (assuming
          a 5% net margin).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {r.staffing && (
          <Card icon={<Users className="size-4" />} title="Labor on quiet days" value={`${formatCompactCurrency(r.staffing.trimValue)}/mo`}>
            Crewing every day the same pays for ~{Math.round(r.staffing.trimHours)} labor hours on quiet days — and runs ~
            {Math.round(r.staffing.addHours)} hours short on busy ones. Assumes ${r.staffing.splh} sales per labor hour and $
            {r.staffing.wage}/hour; adjustable in the full plan.
          </Card>
        )}
        <Card icon={<Sparkles className="size-4" />} title="Your slowest hours" value={`${formatCompactCurrency(r.promo.profitPerMonth)}/mo`}>
          Targeted offers in your slowest windows ({r.slowest.join(", ").toLowerCase()}) project {signed(r.promo.expected)} in
          revenue ({formatCompactCurrency(r.promo.low)}–{formatCompactCurrency(r.promo.high)}, {r.promo.confidence} confidence) —
          mostly profit, since staff and rent are already paid.
        </Card>
      </div>

      {r.model && (
        <p className="text-xs text-fg-subtle">
          Forecast tested on days it never saw: typical error {Math.round(r.model.mape * 100)}%,{" "}
          {r.model.skill > 0 ? `${Math.round(r.model.skill * 100)}% better than "same as last week"` : `about as good as "same as last week"`}.{" "}
          <Link href="/accuracy" className="underline">
            How we test this
          </Link>
          .
        </p>
      )}

      <NextSteps found={r.totalPerMonth} restaurant={venue.name} source="audit" />
    </section>
  );
}

function CheckResult({ r }: { r: CampaignCheck }) {
  const p = r.proof;
  const verdict = {
    proven: ["It worked — your register proves it.", "var(--os-mint)"],
    promising: ["Probably helped — not proven yet.", "var(--os-amber)"],
    "no-lift": ["No measurable lift.", "var(--fg)"],
    "too-early": ["Too early to tell.", "var(--fg)"],
  }[p.verdict];
  const max = Math.max(1, ...p.daily.flatMap((d) => [d.actual, d.expected]));
  return (
    <section className="mt-10 space-y-5">
      <div className="rounded-xl border-2 p-7" style={{ borderColor: verdict[1], background: "var(--surface)" }}>
        <div className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: verdict[1] }}>
          <ShieldCheck className="size-4" /> {verdict[0]}
        </div>
        <div className="mt-2 font-display text-[clamp(40px,6vw,64px)] leading-none" style={{ color: verdict[1] }}>
          {signed(p.lift)}
        </div>
        <div className="mt-2 font-mono text-[12px] text-fg-muted">
          vs. what sales would have been without it · 80% range {signed(p.low80)} to {signed(p.high80)} · {p.days_covered} days ·
          baseline from {r.preDays} days before {r.start}
        </div>
        {r.spend && (
          <p className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-[15px]">
            You paid about <strong>{formatCompactCurrency(r.spend.total)}</strong>.{" "}
            {r.spend.cautiousReturn && r.spend.cautiousReturn > 0 ? (
              <>
                Even at the cautious end, it returned <strong>{r.spend.cautiousReturn.toFixed(1)}×</strong> that in profit.
              </>
            ) : (
              <>Your register can&apos;t show a dollar of profit it reliably earned back.</>
            )}
          </p>
        )}
        <div className="mt-6 flex h-28 items-end gap-[3px]">
          {p.daily.map((d) => (
            <div key={d.date} className="relative flex h-full flex-1 items-end" title={`${d.date}: ${formatCompactCurrency(d.actual)} vs ${formatCompactCurrency(d.expected)} expected`}>
              <div className="absolute inset-x-0 bottom-0 rounded-t-sm border" style={{ height: `${(d.expected / max) * 100}%`, borderColor: "var(--fg-subtle)" }} />
              <div
                className="relative w-full rounded-t-sm"
                style={{ height: `${(d.actual / max) * 100}%`, background: d.actual >= d.expected ? "var(--os-mint)" : "var(--os-rust)", opacity: 0.7 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 font-mono text-[10px] text-fg-subtle">■ ACTUAL · □ EXPECTED WITHOUT THE CAMPAIGN</div>
      </div>
      <NextSteps restaurant={null} source="check" />
    </section>
  );
}

function Card({ icon, title, value, children }: { icon: React.ReactNode; title: string; value: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span style={{ color: "var(--os-amber)" }}>{icon}</span>
        {title}
        <span className="ml-auto font-display text-2xl" style={{ color: "var(--os-mint)" }}>
          {value}
        </span>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted text-pretty">{children}</p>
    </div>
  );
}

function NextSteps({ found, restaurant, source }: { found?: number; restaurant: string | null; source: "audit" | "check" }) {
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        phone: phone || undefined,
        restaurant: restaurant ?? undefined,
        source,
        foundPerMonth: found ? Math.round(found) : undefined,
      }),
    });
    if (res.ok) setSent(true);
    else setErr((await res.json().catch(() => ({}))).error ?? "Couldn't send — try again.");
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="text-[17px] font-semibold">Go get it — free to start</div>
        <p className="mt-1.5 text-[14px] text-fg-muted text-pretty">
          Swell builds the month: offers for your slow hours, a poster and caption for each day, a staffing plan — then proves
          what it earned. Pay nothing unless your register proves it.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/sign-up" className="inline-flex items-center gap-1.5 rounded-md px-4 py-2.5 text-[14px] font-semibold text-white" style={{ background: "var(--os-amber)" }}>
            Start free <ArrowRight className="size-4" />
          </Link>
          <Link href="/pricing" className="inline-flex items-center rounded-md border border-border px-4 py-2.5 text-[14px] font-semibold">
            How pay-for-proof works
          </Link>
        </div>
      </div>
      <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-6">
        <div className="text-[17px] font-semibold">Rather we set it up with you?</div>
        <p className="mt-1.5 text-[14px] text-fg-muted">A founder will walk through your numbers with you — 15 minutes.</p>
        {sent ? (
          <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold" style={{ color: "var(--os-mint)" }}>
            <Check className="size-4" /> Got it — we&apos;ll be in touch within a day.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-border bg-bg px-3 py-2 text-sm" />
            <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded border border-border bg-bg px-3 py-2 text-sm" />
            <button className="w-full rounded-md border border-border py-2.5 text-[14px] font-semibold transition hover:bg-surface-2">
              Book my walkthrough
            </button>
            {err && <p className="text-xs" style={{ color: "var(--os-rust)" }}>{err}</p>}
          </div>
        )}
      </form>
    </div>
  );
}
