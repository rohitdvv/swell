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
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Badge, Card, Field, Input, Segmented } from "@/components/ui";
import { CampaignBoard } from "@/components/campaign-board";
import { toast } from "@/components/toaster";
import type { ParsedSalesSummary, CampaignWithDays, Campaign } from "@/lib/types";
import { formatCurrency, formatNumber, formatCompactCurrency } from "@/lib/utils";

const BRAIN_PASSWORD = process.env.NEXT_PUBLIC_BRAIN_PASSWORD || "swell";

export default function ConsolePage() {
  const [unlocked, setUnlocked] = React.useState(false);
  React.useEffect(() => {
    setUnlocked(sessionStorage.getItem("swell-brain") === "1");
  }, []);
  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />;
  return <Console />;
}

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState(false);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw === BRAIN_PASSWORD) {
      sessionStorage.setItem("swell-brain", "1");
      onUnlock();
    } else {
      setErr(true);
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Card className="p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-ember-gradient shadow-ember">
              <Lock className="size-5 text-white" />
            </div>
            <Logo href={null} />
            <p className="mt-2 text-sm text-fg-muted">The Brain Console</p>
            <p className="text-xs text-fg-subtle">Internal — Aiden, Jerrell & team</p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="password"
              placeholder="Shared password"
              value={pw}
              autoFocus
              onChange={(e) => {
                setPw(e.target.value);
                setErr(false);
              }}
              className={err ? "border-red-400 focus:ring-red-500/20" : ""}
            />
            {err && <p className="text-xs text-red-500">Incorrect password.</p>}
            <Button type="submit" className="w-full" size="lg">
              Enter <ArrowRight className="size-4" />
            </Button>
          </form>
          <p className="mt-4 text-center text-[11px] text-fg-subtle">
            Hint for demo: <code className="rounded bg-surface-2 px-1">swell</code>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

type Phase = "input" | "generating" | "result";

function Console() {
  const [sales, setSales] = React.useState<ParsedSalesSummary | null>(null);
  const [salesMeta, setSalesMeta] = React.useState<{ name: string; filename: string } | null>(null);
  const [url, setUrl] = React.useState("");
  const [name, setName] = React.useState("");
  const [marketplace, setMarketplace] = React.useState<"demo" | "neutral">("demo");
  const [phase, setPhase] = React.useState<Phase>("input");
  const [parsing, setParsing] = React.useState(false);
  const [result, setResult] = React.useState<CampaignWithDays | null>(null);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [publishing, setPublishing] = React.useState(false);

  const loadCampaigns = React.useCallback(async () => {
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    setCampaigns(data.campaigns || []);
  }, []);
  React.useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-csv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSales(data.sales);
      setSalesMeta({ name: data.meta.name, filename: data.meta.filename });
      setName(data.meta.name);
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
      setSales(data.sales);
      setSalesMeta({ name: data.meta.name, filename: data.meta.filename });
      setName(data.meta.name);
      toast("Loaded Osteria Lume sample.", "success");
    } catch {
      toast("Could not load sample.", "error");
    } finally {
      setParsing(false);
    }
  }

  async function generate() {
    if (!sales) return;
    setPhase("generating");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sales, url: url.trim(), name: name.trim(), marketplace }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.campaign);
      setPhase("result");
      loadCampaigns();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Generation failed.", "error");
      setPhase("input");
    }
  }

  async function publish() {
    if (!result) return;
    setPublishing(true);
    try {
      await fetch(`/api/campaigns/${result.slug}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
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
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border glass">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Logo />
          <Badge tone="muted" className="hidden sm:inline-flex">
            Brain Console
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            {phase === "result" && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="size-3.5" /> New
              </Button>
            )}
            <ThemeToggle />
          </div>
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
              </div>
            </StepCard>

            {/* Step 3 — marketplace */}
            <StepCard n={3} title="Marketplace read" icon={<Store className="size-4" />}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-sm text-sm text-fg-muted">
                  Blend live consumer demand (saves, redemptions, neighborhood mix) with sales history.
                </p>
                <Segmented
                  value={marketplace}
                  onChange={setMarketplace}
                  options={[
                    { value: "demo", label: "Design-partner" },
                    { value: "neutral", label: "Neutral" },
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
          </motion.div>
        )}

        {phase === "generating" && <GeneratingView key="gen" hasUrl={!!url.trim()} />}

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
  { icon: FileSpreadsheet, label: "Analyst Agent", sub: "z-scoring dayparts vs your baseline" },
  { icon: Sparkles, label: "Strategy Agent", sub: "30 offers — item, window & discount" },
  { icon: Pencil, label: "Copywriter Agent", sub: "on-brand captions + guardrail" },
  { icon: Images, label: "Creative Agent", sub: "a branded poster for every day" },
  { icon: TrendingUp, label: "Revenue Agent", sub: "redemptions × lift → incremental revenue" },
];

function GeneratingView({ hasUrl }: { hasUrl: boolean }) {
  const [active, setActive] = React.useState(0);
  React.useEffect(() => {
    const timers = GEN_STEPS.map((_, i) => setTimeout(() => setActive(i + 1), 550 * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6"
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-ember-gradient shadow-ember">
          <Sparkles className="size-6 text-white" />
        </div>
        <h2 className="font-display text-3xl">The brain is cooking</h2>
        <p className="text-sm text-fg-muted">A campaign that&apos;s been in the kitchen.</p>
      </div>
      <div className="space-y-2.5">
        {GEN_STEPS.map((s, i) => {
          const state = i < active ? "done" : i === active ? "active" : "todo";
          const Icon = s.icon;
          if (i === 0 && !hasUrl) s = { ...s, sub: "neutral branding (no URL)" };
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: state === "todo" ? 0.4 : 1 }}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div
                className={`flex size-8 items-center justify-center rounded-lg ${
                  state === "done"
                    ? "bg-mint-500/15 text-mint-600"
                    : state === "active"
                    ? "bg-ember-gradient text-white"
                    : "bg-surface-2 text-fg-subtle"
                }`}
              >
                {state === "done" ? (
                  <Check className="size-4" />
                ) : state === "active" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-fg-subtle">{s.sub}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
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
