"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  Globe,
  Sparkles,
  Lock,
  ArrowRight,
  Check,
  ExternalLink,
  Archive,
  RotateCcw,
  Loader2,
  Store,
  TrendingUp,
  Pencil,
  Images,
  MapPin,
  CloudSun,
  CalendarDays,
} from "lucide-react";
import { Button, Badge, Card, Field, Input, Segmented } from "@/components/ui";
import { CampaignBoard } from "@/components/campaign-board";
import { toast } from "@/components/toaster";
import { osClass, OS } from "@/components/os-theme";
import { UserButton } from "@clerk/nextjs";
import type { ParsedSalesSummary, CampaignWithDays, Campaign, CampaignRun } from "@/lib/types";
import { formatCurrency, formatNumber, formatCompactCurrency } from "@/lib/utils";
import { compressForUpload } from "@/lib/compress-upload";

type PlanInfo = { id: string; name: string; used: number; limit: number };

export default function ConsolePage() {
  // Clerk middleware guarantees a signed-in user here. There is no paywall:
  // accounts without a plan build on the Free tier, and the server enforces
  // every plan's limits (api/generate).
  const [plan, setPlan] = React.useState<PlanInfo | null | undefined>(undefined);

  React.useEffect(() => {
    fetch("/api/billing/me")
      .then((r) => r.json())
      .then((me) =>
        setPlan(
          me?.tier
            ? { id: me.tier.id, name: me.tier.name, used: me.usage?.campaigns ?? 0, limit: me.usage?.limit ?? 1 }
            : null
        )
      )
      .catch(() => setPlan(null));
  }, []);

  if (plan === undefined) {
    return (
      <div
        className={osClass("flex min-h-screen items-center justify-center gap-2")}
        style={{ background: OS.bg, color: OS.muted }}
      >
        <Loader2 className="size-4 animate-spin" /> Opening your console…
      </div>
    );
  }

  return <Console plan={plan} />;
}

type Phase = "input" | "generating" | "result";

function Console({ plan }: { plan: PlanInfo | null }) {
  const [quota, setQuota] = React.useState<string | null>(null);
  const [sales, setSales] = React.useState<ParsedSalesSummary | null>(null);
  const [salesMeta, setSalesMeta] = React.useState<{ name: string; filename: string } | null>(null);
  const [url, setUrl] = React.useState("");
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [marketplace, setMarketplace] = React.useState<"demo" | "neutral">("demo");
  const [phase, setPhase] = React.useState<Phase>("input");
  const [parsing, setParsing] = React.useState(false);
  const [result, setResult] = React.useState<CampaignWithDays | null>(null);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [runs, setRuns] = React.useState<CampaignRun[]>([]);
  const [publishing, setPublishing] = React.useState(false);
  const [live, setLive] = React.useState<Record<string, LiveAgent>>({});

  const loadCampaigns = React.useCallback(async () => {
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    setCampaigns(data.campaigns || []);
  }, []);
  const loadRuns = React.useCallback(async () => {
    try {
      const res = await fetch("/api/runs");
      const data = await res.json();
      setRuns(data.runs || []);
    } catch {
      /* history is nice-to-have; never block the console on it */
    }
  }, []);
  React.useEffect(() => {
    loadCampaigns();
    loadRuns();
  }, [loadCampaigns, loadRuns]);

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", await compressForUpload(file));
      const res = await fetch("/api/parse-csv", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({
        error: res.status === 413 ? "That file is too large — export a shorter date range." : "Upload failed.",
      }));
      if (!res.ok) throw new Error(data.error);
      setSales(data.sales);
      setSalesMeta({ name: data.meta.name, filename: data.meta.filename });
      setName(data.meta.name);
      if (data.meta.location) setLocation(data.meta.location);
      toast("Sales history parsed.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not parse file.", "error");
    } finally {
      setParsing(false);
    }
  }

  async function loadSample() {
    setParsing(true);
    try {
      const res = await fetch("/api/parse-csv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.sales) throw new Error(data.error);
      setSales(data.sales);
      setSalesMeta({ name: data.meta.name, filename: data.meta.filename });
      setName(data.meta.name);
      if (data.meta.location) setLocation(data.meta.location);
      toast("Loaded Osteria Lume sample.", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Could not load sample.", "error");
    } finally {
      setParsing(false);
    }
  }

  async function generate() {
    if (!sales) return;
    setQuota(null);
    setLive({});
    setPhase("generating");
    try {
      // Stream the run: the server emits an event as each agent starts and
      // finishes, so the console shows the brain actually working.
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ sales, url: url.trim(), name: name.trim(), location: location.trim(), marketplace }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (data.upgrade) setQuota(data.error);
        throw new Error(data.error || `Generation failed (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneSlug: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let evt: { type: string; agent?: string; role?: string; detail?: string; ms?: number; slug?: string; message?: string; upgrade?: string };
          try {
            evt = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (evt.type === "agent:start" && evt.agent) {
            setLive((m) => ({ ...m, [evt.agent!]: { status: "thinking" } }));
          } else if (evt.type === "agent:done" && evt.agent) {
            setLive((m) => ({ ...m, [evt.agent!]: { status: "done", detail: evt.detail, ms: evt.ms } }));
          } else if (evt.type === "done" && evt.slug) {
            doneSlug = evt.slug;
          } else if (evt.type === "error") {
            if (evt.upgrade) setQuota(evt.message ?? null);
            throw new Error(evt.message || "Generation failed.");
          }
        }
      }

      if (!doneSlug) throw new Error("The run ended without a result — try again.");
      const cres = await fetch(`/api/campaigns/${doneSlug}`);
      const cdata = await cres.json();
      if (!cres.ok || !cdata.campaign) throw new Error("Generated, but could not load the campaign.");
      setResult(cdata.campaign);
      setPhase("result");
      loadCampaigns();
      loadRuns();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Generation failed.", "error");
      setPhase("input");
    }
  }

  async function publish() {
    if (!result) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/campaigns/${result.slug}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      if (!res.ok) throw new Error();
      toast("Published. Public URL is live.", "success");
      loadCampaigns();
    } catch {
      toast("Could not publish.", "error");
    } finally {
      setPublishing(false);
    }
  }

  function reset() {
    setPhase("input");
    setResult(null);
    setSales(null);
    setSalesMeta(null);
    setUrl("");
    setName("");
    setLocation("");
  }

  return (
    <div className={osClass("min-h-screen")} style={{ background: OS.bg }}>
      <header
        className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 sm:px-6 lg:px-8"
        style={{ borderColor: OS.line, background: "rgba(251,248,243,0.86)", backdropFilter: "blur(14px)" }}
      >
        <Link href="/" className="flex items-baseline gap-2" title="Home">
          <span className="font-display text-xl">Swell</span>
          <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: OS.amber }}>OS</span>
        </Link>
        <span className="os-label hidden md:block">CONSOLE</span>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/" className="hidden text-sm sm:block" style={{ color: OS.muted }}>
            Home
          </Link>
          {phase === "result" && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] transition hover:brightness-110"
              style={{ color: OS.muted }}
            >
              <RotateCcw className="size-3.5" /> New
            </button>
          )}
          <Link href="/account" className="hidden text-sm sm:block" style={{ color: OS.muted }}>
            Account
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        </div>
      </header>

      <AnimatePresence mode="wait">
        {phase === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-3xl px-4 py-8 sm:px-6"
          >
            <div className="mb-8">
              <h1 className="font-display text-4xl">Generate a campaign</h1>
              <p className="mt-1 text-fg-muted">
                Three inputs in. A 30-day branded plan out. One tap to publish.
              </p>
            </div>

            {plan && <PlanBar plan={plan} />}
            {quota && (
              <div
                className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
                style={{ borderColor: "rgba(232,163,61,0.45)", background: "rgba(232,163,61,0.08)" }}
              >
                <Lock className="size-4 shrink-0" style={{ color: OS.amber }} />
                <span className="min-w-0 flex-1">{quota}</span>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-[13px] font-semibold"
                  style={{ background: OS.amber, color: OS.bg }}
                >
                  See plans <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}

            {/* Step 1 — sales */}
            <StepCard
              n={1}
              title="Sales history"
              done={!!sales}
              icon={<FileSpreadsheet className="size-4" />}
            >
              {!sales ? (
                <Dropzone onFile={handleFile} onSample={loadSample} parsing={parsing} />
              ) : (
                <SalesPreview sales={sales} filename={salesMeta?.filename || ""} onClear={() => setSales(null)} />
              )}
            </StepCard>

            {/* Step 2 — brand */}
            <StepCard n={2} title="Brand kit" optional icon={<Globe className="size-4" />}>
              <div className="space-y-3">
                <Field label="Restaurant name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Osteria Lume" />
                </Field>
                <Field label="Website URL" hint="We fetch logo, colors, fonts & brand voice. Leave blank for neutral branding.">
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="yourrestaurant.com"
                  />
                </Field>
                <Field
                  label="Location"
                  hint="City, neighborhood or address — powers live weather + local-event targeting."
                >
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Greenwich Village, New York"
                  />
                </Field>
              </div>
            </StepCard>

            {/* Step 3 — marketplace */}
            <StepCard n={3} title="Marketplace read" icon={<Store className="size-4" />}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-sm text-sm text-fg-muted">
                  Blend consumer demand (neighborhood mix, saves, redemptions) with sales history.
                  {marketplace === "demo" ? (
                    <span className="mt-1 block text-xs text-fg-subtle">
                      Simulated preview — figures are modeled from neighborhood + sales, clearly
                      labeled &ldquo;simulated&rdquo; until the Swell consumer app is live here.
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs text-fg-subtle">
                      Sales-only — no marketplace estimates; every number is from the upload.
                    </span>
                  )}
                </p>
                <Segmented
                  value={marketplace}
                  onChange={setMarketplace}
                  options={[
                    { value: "demo", label: "Simulated demand" },
                    { value: "neutral", label: "Sales-only" },
                  ]}
                />
              </div>
            </StepCard>

            <div className="sticky bottom-4 mt-6">
              <Button
                onClick={generate}
                disabled={!sales}
                size="lg"
                className="w-full shadow-lift"
              >
                <Sparkles className="size-4" />
                Generate 30-day campaign
              </Button>
            </div>

            {campaigns.length > 0 && (
              <CampaignList campaigns={campaigns} onChange={loadCampaigns} className="mt-12" />
            )}
            {runs.length > 0 && <RunHistory runs={runs} className="mt-12" />}
          </motion.div>
        )}

        {phase === "generating" && <GeneratingView key="gen" hasUrl={!!url.trim()} live={live} />}

        {phase === "result" && result && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="border-b border-border bg-surface-2/50">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex size-9 items-center justify-center rounded-full bg-mint-500/15">
                  <Check className="size-4 text-mint-600" />
                </div>
                <div>
                  <div className="font-semibold">{result.title}</div>
                  <div className="text-xs text-fg-subtle">
                    {result.month} · {result.restaurant_name}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="secondary" onClick={publish} loading={publishing}>
                    <ExternalLink className="size-4" /> Publish
                  </Button>
                  <Link href={`/c/${result.slug}`} target="_blank">
                    <Button>
                      Open artifact <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
            <CampaignBoard initial={result} editable />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepCard({
  n,
  title,
  children,
  icon,
  done,
  optional,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  done?: boolean;
  optional?: boolean;
}) {
  return (
    <Card className="mb-4 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
            done ? "bg-mint-500 text-white" : "bg-surface-2 text-fg-muted"
          }`}
        >
          {done ? <Check className="size-3.5" /> : n}
        </div>
        <span className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </span>
        {optional && <Badge tone="muted">Optional</Badge>}
      </div>
      {children}
    </Card>
  );
}

function Dropzone({
  onFile,
  onSample,
  parsing,
}: {
  onFile: (f: File) => void;
  onSample: () => void;
  parsing: boolean;
}) {
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          drag ? "border-ember-400 bg-ember-50/50" : "border-border-strong hover:border-ember-300 hover:bg-surface-2"
        }`}
      >
        {parsing ? (
          <Loader2 className="size-6 animate-spin text-ember-500" />
        ) : (
          <Upload className="size-6 text-fg-subtle" />
        )}
        <p className="mt-2 text-sm font-medium">
          {parsing ? "Parsing…" : "Drop your Toast / Square export"}
        </p>
        <p className="text-xs text-fg-subtle">CSV or XLSX · 14+ days of data</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>
      <button
        onClick={onSample}
        className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-ember-600 hover:text-ember-700"
      >
        <Sparkles className="size-3.5" /> No CSV handy? Load the Osteria Lume sample
      </button>
    </div>
  );
}

function SalesPreview({
  sales,
  filename,
  onClear,
}: {
  sales: ParsedSalesSummary;
  filename: string;
  onClear: () => void;
}) {
  const stats = [
    { label: "Net sales", value: formatCompactCurrency(sales.total_net_sales) },
    { label: "Orders", value: formatNumber(sales.order_count) },
    { label: "Days", value: `${sales.date_range.days}` },
    { label: "Avg check", value: formatCurrency(sales.total_net_sales / Math.max(1, sales.order_count)) },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <FileSpreadsheet className="size-4 text-mint-600" />
        <span className="font-medium">{filename}</span>
        <button onClick={onClear} className="ml-auto text-xs text-fg-subtle hover:text-fg">
          Replace
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-surface-2 px-3 py-2.5">
            <div className="text-xs text-fg-subtle">{s.label}</div>
            <div className="text-lg font-semibold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sales.top_items.slice(0, 5).map((it) => (
          <Badge key={it.name} tone="neutral">
            {it.name}
          </Badge>
        ))}
      </div>
    </motion.div>
  );
}

const GEN_STEPS = [
  { icon: Globe, label: "Brand Agent", sub: "logo, palette, fonts, voice & imagery" },
  { icon: Store, label: "Demand Agent", sub: "saves, redemptions, neighborhood mix" },
  { icon: MapPin, label: "Location Agent", sub: "geocoding your venue" },
  { icon: CloudSun, label: "Weather Agent", sub: "live forecast + seasonal normals" },
  { icon: CalendarDays, label: "Events Agent", sub: "holidays & nearby events" },
  { icon: FileSpreadsheet, label: "Analyst Agent", sub: "z-scoring dayparts vs your baseline" },
  { icon: Sparkles, label: "Strategy Agent", sub: "30 offers, adapted to weather & events" },
  { icon: Pencil, label: "Copywriter Agent", sub: "on-brand captions + guardrail" },
  { icon: Images, label: "Creative Agent", sub: "a branded poster for every day" },
  { icon: TrendingUp, label: "Revenue Agent", sub: "redemptions × lift → incremental revenue" },
];

type LiveAgent = { status: "thinking" | "done"; detail?: string; ms?: number };

/**
 * The live run console. Every card is driven by REAL events streamed from the
 * orchestrator — an agent flips to "thinking" the moment it starts and shows
 * its actual finding (and how long it took) the moment it reports back.
 */
function GeneratingView({ hasUrl, live }: { hasUrl: boolean; live: Record<string, LiveAgent> }) {
  const doneCount = Object.values(live).filter((a) => a.status === "done").length;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6 py-10"
    >
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-ember-gradient shadow-ember">
          <Sparkles className="size-6 text-white" />
        </div>
        <h2 className="font-display text-3xl">The brain is working</h2>
        <p className="text-sm text-fg-muted">
          {doneCount}/{GEN_STEPS.length} agents reported · live from the run
        </p>
        <div className="mx-auto mt-3 h-1 w-48 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-ember-gradient transition-all duration-500"
            style={{ width: `${(doneCount / GEN_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="space-y-2">
        {GEN_STEPS.map((s, i) => {
          const a = live[s.label] as LiveAgent | undefined;
          const state: "todo" | "thinking" | "done" = a?.status ?? "todo";
          const Icon = s.icon;
          const waitingSub = i === 0 && !hasUrl ? "neutral branding (no URL)" : s.sub;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0.35 }}
              animate={{ opacity: state === "todo" ? 0.35 : 1, scale: state === "thinking" ? 1.01 : 1 }}
              className={`flex items-start gap-3 rounded-xl border bg-surface px-4 py-3 ${
                state === "thinking" ? "border-ember-400/60 shadow-ember" : "border-border"
              }`}
            >
              <div
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  state === "done"
                    ? "bg-mint-500/15 text-mint-600"
                    : state === "thinking"
                      ? "bg-ember-gradient text-white"
                      : "bg-surface-2 text-fg-subtle"
                }`}
              >
                {state === "done" ? (
                  <Check className="size-4" />
                ) : state === "thinking" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{s.label}</span>
                  {state === "done" && a?.ms != null && (
                    <span className="text-[10px] tabular-nums text-fg-subtle">
                      {a.ms >= 1000 ? `${(a.ms / 1000).toFixed(1)}s` : `${a.ms}ms`}
                    </span>
                  )}
                </div>
                <div className={`text-xs ${state === "done" ? "text-fg-muted" : "text-fg-subtle"} text-pretty`}>
                  {state === "done" && a?.detail
                    ? a.detail
                    : state === "thinking"
                      ? "thinking…"
                      : waitingSub}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

const CONFIDENCE_TONE: Record<CampaignRun["confidence"], string> = {
  high: "bg-mint-500/15 text-mint-600",
  moderate: "bg-amber-500/15 text-amber-600",
  low: "bg-rose-500/15 text-rose-600",
};

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/**
 * Regenerating replaces a campaign, so without this the owner has no way to
 * see what the brain projected last week versus today.
 */
function RunHistory({ runs, className }: { runs: CampaignRun[]; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-fg-muted">Run history</h2>
        <span className="text-xs text-fg-subtle">
          Every generation, and what it projected at the time
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-fg-subtle">
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Restaurant</th>
              <th className="px-4 py-2.5 font-medium">Read</th>
              <th className="px-4 py-2.5 font-medium">Projected (low–high)</th>
              <th className="px-4 py-2.5 font-medium">Confidence</th>
              <th className="px-4 py-2.5 font-medium">Checks</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-fg-muted" title={r.created_at}>
                  {relativeTime(r.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.restaurant_name}</div>
                  {r.location && <div className="text-xs text-fg-subtle">{r.location}</div>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-fg-subtle">
                  {r.forecast_days}d forecast
                  {r.seasonal_days > 0 && ` + ${r.seasonal_days}d seasonal`}
                  <br />
                  {r.event_days} event days · {(r.duration_ms / 1000).toFixed(1)}s
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="font-semibold tabular-nums">
                    {formatCompactCurrency(r.projected_expected)}
                  </div>
                  <div className="text-xs tabular-nums text-fg-subtle">
                    {formatCompactCurrency(r.projected_low)} –{" "}
                    {formatCompactCurrency(r.projected_high)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${CONFIDENCE_TONE[r.confidence]}`}
                  >
                    {r.confidence}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">
                  <span
                    className={
                      r.checks_passed === r.checks_total ? "text-mint-600" : "text-rose-600"
                    }
                  >
                    {r.checks_passed}/{r.checks_total}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/c/${r.campaign_slug}`} target="_blank">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignList({
  campaigns,
  onChange,
  className,
}: {
  campaigns: Campaign[];
  onChange: () => void;
  className?: string;
}) {
  async function archive(slug: string) {
    await fetch(`/api/campaigns/${slug}`, { method: "DELETE" });
    toast("Archived.", "info");
    onChange();
  }
  return (
    <div className={className}>
      <h2 className="mb-3 text-sm font-semibold text-fg-muted">Your campaigns</h2>
      <div className="space-y-2">
        {campaigns.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
          >
            <div
              className="size-9 shrink-0 rounded-lg"
              style={{ background: c.brand?.primary_color || "#f75410" }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.restaurant_name}</div>
              <div className="text-xs text-fg-subtle">
                {c.month} · {formatCompactCurrency(c.projected_revenue)} projected
              </div>
            </div>
            <Badge tone={c.status === "published" ? "mint" : "muted"}>{c.status}</Badge>
            <Link href={`/c/${c.slug}`} target="_blank">
              <Button variant="ghost" size="sm">
                <ExternalLink className="size-3.5" />
              </Button>
            </Link>
            <button
              onClick={() => archive(c.slug)}
              className="text-fg-subtle hover:text-red-500"
              title="Archive"
            >
              <Archive className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanBar({ plan }: { plan: PlanInfo }) {
  const unlimited = plan.limit === -1;
  const full = !unlimited && plan.used >= plan.limit;
  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5"
      style={{ borderColor: OS.line2, background: OS.panel }}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: OS.amber }}>
        {plan.name} plan
      </span>
      <span className="text-[13px]" style={{ color: OS.muted }}>
        {unlimited
          ? "Unlimited campaigns"
          : `${plan.used} of ${plan.limit} campaign${plan.limit === 1 ? "" : "s"} this month`}
        {plan.id === "free" && !full && " · no card needed · regenerate any time"}
        {full && " · regenerating an existing campaign is still free"}
      </span>
      {plan.id === "free" && (
        <Link href="/pricing" className="ml-auto text-[13px] font-semibold" style={{ color: OS.amber }}>
          Upgrade
        </Link>
      )}
    </div>
  );
}
