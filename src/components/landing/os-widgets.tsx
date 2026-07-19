"use client";

import * as React from "react";
import { OS } from "@/components/os-theme";

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ============================================================
// 1 · HERO PIPELINE — the 10-agent run, playing out live
// ============================================================

/** [name, tag, log line] — mirrors the real orchestrator's agent order. */
const AGENTS: [string, string, string][] = [
  ["Brand", "logo · palette · voice", "brand: lifted #C24A22, serif display, voice=warm"],
  ["Demand", "marketplace signal", "demand: 312 saves · 243 redemptions · lift ×1.18"],
  ["Location", "geocode venue", "location: 40.7336, -74.0027 — Greenwich Village"],
  ["Weather", "16-day live forecast", "weather: rain Tue 58° · clear Sat 82° · 16d live + normals"],
  ["Events", "holidays + tickets", "events: game @ MSG Sat · Bastille Day Jul 14"],
  ["Analyst", "z-score dayparts", "analyst: Tue 2–5pm z=-1.9 · Mon lunch z=-1.4 · MAE 8.2%"],
  ["Strategy", "compose 30 offers", "strategy: 30 offers · discounts 10–45% · 70/30 blend"],
  ["Copywriter", "captions + guardrail", "copy: 30 captions ≤80 chars · 0 claims flagged"],
  ["Creative", "poster per day", "creative: rendering 30 branded posters… duotone #C24A22"],
  ["Revenue", "projection + range", "revenue: +$3,246 expected · range $1.5K–$5.9K · moderate"],
];

export function HeroPipeline() {
  const [step, setStep] = React.useState(REDUCED ? 10 : 0);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (REDUCED) return;
    const iv = setInterval(() => {
      setTick((t) => t + 1);
      setStep((s) => (s + 1) % 14);
    }, 950);
    return () => clearInterval(iv);
  }, []);

  const phase = Math.min(step, 10);
  const prog = Math.min(phase / 10, 1);
  const daysCount = Math.round(30 * Math.min(1, prog * 1.4));
  const postersCount = phase >= 9 ? 30 : phase >= 8 ? Math.round(30 * ((phase - 7) / 2)) : 0;
  const revenueLabel =
    phase >= 10 ? "+$3.2K" : phase >= 9 ? `+$${(Math.round(prog * 32) / 10).toFixed(1)}K` : "—";
  const mm = String(Math.floor(tick / 60)).padStart(2, "0");
  const ss = String(tick % 60).padStart(2, "0");

  const logLines: { text: string; color: string }[] = [];
  for (let i = Math.max(0, phase - 5); i < phase; i++) {
    logLines.push({ text: `✓ ${AGENTS[i][2]}`, color: OS.muted });
  }
  if (phase < 10) logLines.push({ text: `▸ ${AGENTS[phase][2]}`, color: OS.amber });
  else logLines.push({ text: "■ run complete — campaign published to /c/osteria-lume", color: OS.mint });

  return (
    <div className="os-fade-up-delay">
      <div
        className="relative overflow-hidden rounded-lg border"
        style={{ borderColor: OS.line2, background: OS.panel, boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" }}
      >
        <div className="flex items-center gap-2.5 border-b px-4.5 py-3.5" style={{ borderColor: OS.line, paddingInline: 18 }}>
          <span className="os-pulse size-[7px] rounded-full" style={{ background: OS.mint }} />
          <span className="font-mono text-[11px] tracking-[0.16em]" style={{ color: OS.muted }}>
            LIVE RUN — OSTERIA LUME · GREENWICH VILLAGE
          </span>
          <span className="ml-auto font-mono text-[11px] tabular-nums" style={{ color: OS.subtle }}>
            {mm}:{ss}
          </span>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "172px 1fr" }}>
          <div className="border-r py-3.5" style={{ borderColor: OS.line }}>
            {AGENTS.map(([name, tag], i) => {
              const done = i < phase;
              const active = i === phase;
              return (
                <div key={name} className="flex items-center gap-2.5 px-4 py-[5px]">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{
                      background: done ? OS.mint : active ? OS.amber : "rgba(237,232,220,0.15)",
                      boxShadow: active ? "0 0 8px rgba(232,163,61,0.9)" : "none",
                    }}
                  />
                  <span
                    className="font-mono text-[11.5px] tracking-[0.04em] whitespace-nowrap"
                    style={{ color: done ? OS.fg : active ? OS.amber : OS.subtle }}
                    title={tag}
                  >
                    {name}
                  </span>
                  {/* The rail is only 172px — the tag is a tooltip until
                      there's genuinely room, so names never wrap. */}
                  <span
                    className="ml-auto hidden truncate font-mono text-[10px] 2xl:block"
                    style={{ color: OS.subtle }}
                  >
                    {tag}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex min-h-[300px] flex-col px-4.5 py-4" style={{ paddingInline: 18 }}>
            <div className="flex flex-1 flex-col gap-[7px] font-mono text-[11px] leading-[1.5]">
              {logLines.map((l, i) => (
                <div key={i} style={{ color: l.color }} className="break-words">
                  {l.text}
                </div>
              ))}
            </div>
            <div
              className="mt-4 grid grid-cols-3 gap-2.5 border-t pt-3.5"
              style={{ borderColor: OS.line }}
            >
              <PipelineStat label="DAYS PLANNED" value={String(daysCount)} />
              <PipelineStat label="POSTERS" value={String(postersCount)} />
              <PipelineStat label="PROJECTED" value={revenueLabel} color={OS.mint} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 text-right font-mono text-[10px] tracking-[0.12em]" style={{ color: OS.subtle }}>
        10-AGENT ORCHESTRATION · EVERY RUN LEAVES A TRACE
      </div>
    </div>
  );
}

function PipelineStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="font-mono text-[9.5px] tracking-[0.14em]" style={{ color: OS.subtle }}>
        {label}
      </div>
      <div className="mt-0.5 font-display text-[26px] tabular-nums" style={{ color: color ?? OS.fg }}>
        {value}
      </div>
    </div>
  );
}

// ============================================================
// 2 · MONTH EXPLORER — hover any day, see the reasoning
// ============================================================

const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DISHES = [
  "Cacio e Pepe",
  "Margherita",
  "Rigatoni alla Vodka",
  "Aperol Spritz",
  "Tiramisù",
  "Burrata",
  "Lasagna al Forno",
  "Polpette",
];

type DayCell = {
  dow: string;
  num: number;
  icon: string;
  pct: string;
  pctColor: string;
  isEvent: boolean;
  label: string;
  cond: string;
  condColor: string;
  offer: string;
  why: string;
};

function buildMonth(): DayCell[] {
  return Array.from({ length: 30 }, (_, i) => {
    const dow = DOW[i % 7];
    const rainy = i % 7 === 1 || i % 11 === 4;
    const isEvent = i % 7 === 5 && i % 2 === 1;
    const dish = DISHES[(i * 3) % DISHES.length];
    const pct = isEvent ? 0 : rainy ? 30 : 10 + ((i * 7) % 16);
    const win = isEvent ? "5–9 PM" : i % 2 ? "2–5 PM" : "11 AM–2 PM";
    return {
      dow,
      num: i + 1,
      icon: isEvent ? "🎫" : rainy ? "🌧" : "☀",
      pct: isEvent ? "HERO" : `-${pct}%`,
      pctColor: isEvent ? OS.mint : pct >= 25 ? OS.amber : OS.subtle,
      isEvent,
      label: `Day ${i + 1} · ${dow}`,
      cond: isEvent
        ? "🎫 GAME DAY · NEARBY ARENA"
        : rainy
          ? "🌧 58° RAIN"
          : `☀ ${72 + (i % 12)}° CLEAR${i > 15 ? " (EST.)" : ""}`,
      condColor: isEvent ? OS.mint : rainy ? "#8FB6D9" : OS.amber,
      offer: isEvent
        ? `${dish} — hero item, no discount, ${win}`
        : `${dish} — ${pct}% off, ${win}`,
      why: isEvent
        ? "Crowd is already coming. Ride it at full margin."
        : rainy
          ? "Rain suppresses walk-ins — comfort dish, deeper cut fills the slow window."
          : `Sunny ${dow.toLowerCase()} — lighter plate, margin protected.`,
    };
  });
}

export function MonthExplorer() {
  const month = React.useMemo(() => buildMonth(), []);
  const [sel, setSel] = React.useState(1);
  const d = month[sel];

  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-[72px]">
      <div>
        <div className="font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.amber }}>
          CHAPTER 02 — REAL-TIME INTELLIGENCE
        </div>
        <h2 className="mt-4 font-display text-[clamp(32px,5vw,48px)] font-normal leading-[1.05] tracking-[-0.02em] text-balance">
          It reads the world outside every door you operate.
        </h2>
        <p className="mt-5.5 max-w-[480px] text-[15.5px] leading-[1.65] text-pretty" style={{ color: OS.muted, marginTop: 22 }}>
          A rainy Tuesday in the Village becomes comfort food at a deeper discount. A game night near
          your Chicago location becomes the hero item at full margin. Hover the month — every day
          carries its reasoning.
        </p>

        <div
          className="mt-7 min-h-[118px] rounded-md border px-6 py-5.5"
          style={{ borderColor: OS.line2, background: OS.panel, padding: "22px 24px" }}
        >
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-display text-[30px]" style={{ color: OS.fg }}>
              {d.label}
            </span>
            <span className="font-mono text-[11.5px]" style={{ color: d.condColor }}>
              {d.cond}
            </span>
          </div>
          <div className="mt-2.5 text-[15px] font-medium" style={{ color: OS.fg }}>
            {d.offer}
          </div>
          <div className="mt-1.5 font-display text-[12.5px] italic" style={{ color: OS.muted }}>
            {d.why}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3.5 font-mono text-[10px] tracking-[0.18em]" style={{ color: OS.subtle }}>
          NEXT 30 DAYS — HOVER A DAY
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {month.map((c, i) => {
            const on = i === sel;
            return (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setSel(i)}
                onFocus={() => setSel(i)}
                onClick={() => setSel(i)}
                aria-label={`${c.label}: ${c.offer}`}
                className="rounded-[5px] border p-2.5 text-left transition-colors"
                style={{
                  borderColor: on ? OS.amber : c.isEvent ? "rgba(127,209,174,0.35)" : "rgba(237,232,220,0.1)",
                  background: on ? "rgba(232,163,61,0.08)" : OS.panel,
                }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px]" style={{ color: OS.subtle }}>
                    {c.dow}
                  </span>
                  <span className="text-[13px]">{c.icon}</span>
                </div>
                <div className="mt-1.5 font-display text-[20px]" style={{ color: on ? OS.amber : OS.fg }}>
                  {c.num}
                </div>
                <div className="mt-[3px] font-mono text-[9.5px]" style={{ color: c.pctColor }}>
                  {c.pct}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-5 font-mono text-[10px]" style={{ color: OS.subtle }}>
          <span>
            <span style={{ color: OS.mint }}>●</span> EVENT DAY — MARGIN PROTECTED
          </span>
          <span>
            <span style={{ color: OS.amber }}>●</span> DEEP OFFER — SLOW WINDOW
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 3 · MONEY MATH — drag the assumption, watch the range move
// ============================================================

export function MoneyMath() {
  const [rate, setRate] = React.useState(4.6);

  const mid = Math.round(706 * rate);
  const low = Math.round(706 * rate * 0.46);
  const high = Math.round(706 * rate * 1.82);
  const fmt = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`);
  const conf: [string, string, string] =
    rate > 7
      ? ["LOW", OS.rust, "rgba(228,87,46,0.12)"]
      : rate > 5.5
        ? ["MODERATE", OS.bronze, "rgba(180,118,42,0.14)"]
        : ["MODERATE", "#3E8E6C", "rgba(62,142,108,0.14)"];

  const { bandPath, midPath, basePath } = React.useMemo(() => {
    const W = 720;
    const H = 190;
    const pad = 10;
    const pt = (i: number, v: number) =>
      `${(pad + (i / 29) * (W - 2 * pad)).toFixed(1)} ${(H - 24 - v * (H - 48)).toFixed(1)}`;
    let up = "M";
    let down = "";
    let midP = "M";
    let baseP = "M";
    const spread = Math.min(0.5, 0.16 + rate * 0.045);
    for (let i = 0; i < 30; i++) {
      const wave = 0.32 + 0.22 * Math.sin(i / 4.2) + 0.012 * i + (i % 7 === 5 ? 0.16 : 0);
      const m = Math.min(0.92, wave * (0.55 + rate / 9));
      up += (i ? " L" : "") + pt(i, Math.min(0.98, m + spread * 0.5));
      down = ` L${pt(i, Math.max(0.03, m - spread * 0.5))}${down}`;
      midP += (i ? " L" : "") + pt(i, m);
      baseP += (i ? " L" : "") + pt(i, wave * 0.5);
    }
    return { bandPath: `${up}${down} Z`, midPath: midP, basePath: baseP };
  }, [rate]);

  return (
    <div
      className="rounded-lg border p-6 sm:p-9"
      style={{
        borderColor: "rgba(25,24,19,0.16)",
        background: OS.paperCard,
        boxShadow: "0 24px 60px -30px rgba(25,24,19,0.25)",
      }}
    >
      <div className="flex flex-wrap items-baseline gap-5">
        <div>
          <div className="font-mono text-[10px] tracking-[0.16em]" style={{ color: OS.inkSubtle }}>
            PROJECTED INCREMENTAL / 30 DAYS
          </div>
          <div
            className="mt-1.5 font-display text-[clamp(44px,7vw,64px)] leading-none tabular-nums"
            style={{ color: OS.ink }}
          >
            +{fmt(mid)}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-[10px] tracking-[0.16em]" style={{ color: OS.inkSubtle }}>
            HONEST RANGE
          </div>
          <div className="mt-1.5 font-display text-[28px] tabular-nums" style={{ color: OS.inkMuted }}>
            {fmt(low)} – {fmt(high)}
          </div>
          <div
            className="mt-2 inline-block rounded-[3px] px-2.5 py-1 font-mono text-[10px] tracking-[0.1em]"
            style={{ background: conf[2], color: conf[1] }}
          >
            CONFIDENCE: {conf[0]}
          </div>
        </div>
      </div>

      <svg viewBox="0 0 720 190" className="mt-6 block h-auto w-full" role="img" aria-label="Projection band">
        <path d={bandPath} fill="rgba(232,163,61,0.18)" />
        <path d={midPath} fill="none" stroke={OS.bronze} strokeWidth="2.5" />
        <path d={basePath} fill="none" stroke="rgba(25,24,19,0.3)" strokeWidth="1.5" strokeDasharray="4 5" />
        <text x="6" y="184" fontFamily="var(--font-mono)" fontSize="10" fill={OS.inkSubtle}>
          DAY 1
        </text>
        <text x="676" y="184" fontFamily="var(--font-mono)" fontSize="10" fill={OS.inkSubtle}>
          DAY 30
        </text>
      </svg>

      <div
        className="mt-6 flex flex-col gap-5 border-t pt-6 sm:flex-row sm:items-center"
        style={{ borderColor: "rgba(25,24,19,0.12)" }}
      >
        <div className="flex-1">
          <div
            className="flex justify-between font-mono text-[10.5px] tracking-[0.1em]"
            style={{ color: OS.inkSubtle }}
          >
            <span>ASSUMED RESPONSE RATE</span>
            <span style={{ color: OS.ink }}>{rate.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min={2}
            max={9}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            aria-label="Assumed response rate"
            className="mt-2.5 w-full cursor-ew-resize"
            style={{ accentColor: OS.bronze }}
          />
          <div className="flex justify-between font-mono text-[9.5px]" style={{ color: "#B0AB9D" }}>
            <span>PESSIMISTIC 2%</span>
            <span>OPTIMISTIC 9%</span>
          </div>
        </div>
        <div
          className="font-display text-[12px] italic leading-[1.5] sm:w-[200px]"
          style={{ color: OS.inkMuted }}
        >
          Thin sales history widens the band. Under 21 days, confidence drops to low — the product
          tells you when to trust it less.
        </div>
      </div>
    </div>
  );
}
