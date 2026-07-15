"use client";

import * as React from "react";

// Lightweight, theme-aware SVG charts — no dependencies, bespoke to the
// Swell design system. All responsive via viewBox + width:100%.

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Vertical bar chart with labels underneath. */
export function BarChart({
  data,
  color,
  format = (n) => String(Math.round(n)),
  height = 160,
  highlight,
}: {
  data: { label: string; value: number }[];
  color: string;
  format?: (n: number) => string;
  height?: number;
  highlight?: (d: { label: string; value: number }) => boolean;
}) {
  const w = 100;
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const n = data.length;
  const gap = 2.2;
  const bw = (w - gap * (n - 1)) / n;
  const chartH = height - 26;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" role="img">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line
          key={g}
          x1="0"
          x2={w}
          y1={chartH * (1 - g)}
          y2={chartH * (1 - g)}
          stroke="var(--border)"
          strokeWidth="0.3"
        />
      ))}
      {data.map((d, i) => {
        const bh = (d.value / max) * chartH;
        const x = i * (bw + gap);
        const hot = highlight?.(d);
        return (
          <g key={i}>
            <rect
              x={x}
              y={chartH - bh}
              width={bw}
              height={Math.max(bh, 0.4)}
              rx="1"
              fill={hot ? color : "var(--border-strong)"}
              opacity={hot ? 1 : 0.55}
            />
            <text
              x={x + bw / 2}
              y={height - 14}
              textAnchor="middle"
              fontSize="4.2"
              fill="var(--fg-subtle)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {d.label}
            </text>
            <text x={x + bw / 2} y={height - 6} textAnchor="middle" fontSize="3.6" fill="var(--fg-subtle)">
              {format(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal bars — good for items / dayparts (long labels). */
export function HBars({
  data,
  color,
  format = (n) => String(Math.round(n)),
}: {
  data: { label: string; value: number; hot?: boolean }[];
  color: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-xs text-fg-muted" title={d.label}>
            {d.label}
          </div>
          <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-surface-2">
            <div
              className="h-full rounded-md transition-all"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.hot === false ? "var(--border-strong)" : color,
                opacity: d.hot === false ? 0.6 : 1,
              }}
            />
          </div>
          <div className="w-16 shrink-0 text-right text-xs font-medium tabular-nums">
            {format(d.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Area/line spark with optional day markers (e.g. events). */
export function AreaSpark({
  points,
  color,
  height = 150,
  markers = [],
}: {
  points: number[];
  color: string;
  height?: number;
  markers?: { index: number; icon: string }[];
}) {
  const w = 100;
  const pad = 4;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const n = points.length;
  const x = (i: number) => (i / (n - 1)) * (w - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.1" strokeLinejoin="round" />
      {markers.map((m, i) => (
        <g key={i}>
          <line x1={x(m.index)} x2={x(m.index)} y1={pad} y2={height - pad} stroke={color} strokeWidth="0.4" strokeDasharray="1.5 1.5" opacity="0.5" />
          <text x={x(m.index)} y={pad + 4} textAnchor="middle" fontSize="4">
            {m.icon}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Revenue forecast: real daily history flowing into the projected next 30 days,
 * with a shaded low→high confidence band. Crisp text (no aspect distortion) via
 * a real coordinate viewBox. Theme-aware.
 */
export type ForecastPoint = {
  date: string; // YYYY-MM-DD
  value: number;
  kind: "history" | "forecast";
  low?: number;
  high?: number;
};

export function ForecastChart({
  series,
  color,
  historyColor = "var(--color-mint-500)",
}: {
  series: ForecastPoint[];
  color: string;
  historyColor?: string;
}) {
  const W = 820;
  const H = 340;
  const padL = 62;
  const padR = 18;
  const padT = 18;
  const padB = 40;
  const n = series.length;
  if (n < 2) return null;

  const maxRaw = Math.max(...series.map((p) => Math.max(p.value, p.high ?? 0)), 1);
  const maxY = niceMax(maxRaw);
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);

  const firstForecast = series.findIndex((p) => p.kind === "forecast");
  const boundary = firstForecast <= 0 ? n - 1 : firstForecast;

  // Catmull-Rom → cubic bezier: the line reads as a living signal, not a
  // connect-the-dots polyline.
  const path = (pts: { i: number; v: number }[]) => {
    if (pts.length < 2) return "";
    const P = pts.map((p) => ({ x: x(p.i), y: y(p.v) }));
    let d = `M${P[0].x.toFixed(1)},${P[0].y.toFixed(1)}`;
    for (let k = 0; k < P.length - 1; k++) {
      const p0 = P[k - 1] ?? P[k];
      const p1 = P[k];
      const p2 = P[k + 1];
      const p3 = P[k + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const hist = series.map((p, i) => ({ i, v: p.value })).slice(0, boundary + 1);
  // forecast line continues from the last history point for a seamless join
  const fc = series
    .map((p, i) => ({ i, v: p.value }))
    .slice(Math.max(0, boundary - (boundary > 0 && series[boundary - 1]?.kind === "history" ? 1 : 0)));
  const fcOnly = series.filter((p) => p.kind === "forecast");

  const histLine = path(hist);
  const histArea = `${histLine} L${x(boundary).toFixed(1)},${(H - padB).toFixed(1)} L${x(0).toFixed(1)},${(H - padB).toFixed(1)} Z`;
  const fcLine = path(fc);
  const fcArea =
    fc.length > 1
      ? `${fcLine} L${x(fc[fc.length - 1].i).toFixed(1)},${(H - padB).toFixed(1)} L${x(fc[0].i).toFixed(1)},${(H - padB).toFixed(1)} Z`
      : "";

  // confidence band (only where low/high exist)
  const banded = series.map((p, i) => ({ i, p })).filter((o) => o.p.high != null && o.p.low != null);
  let bandPath = "";
  if (banded.length > 1) {
    const top = banded.map((o) => `${x(o.i).toFixed(1)},${y(o.p.high!).toFixed(1)}`);
    const bot = banded.map((o) => `${x(o.i).toFixed(1)},${y(o.p.low!).toFixed(1)}`).reverse();
    bandPath = `M${top.join(" L")} L${bot.join(" L")} Z`;
  }

  const gy = [0, 0.25, 0.5, 0.75, 1];
  const money = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`;
  const labelEvery = Math.max(1, Math.round(n / 9));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue forecast">
      <defs>
        <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={historyColor} stopOpacity="0.22" />
          <stop offset="1" stopColor={historyColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* gridlines + y labels */}
      {gy.map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={y(maxY * g)} y2={y(maxY * g)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
          <text x={padL - 8} y={y(maxY * g) + 4} textAnchor="end" fontSize="12" fill="var(--fg-subtle)">
            {money(maxY * g)}
          </text>
        </g>
      ))}

      {/* today divider */}
      <line x1={x(boundary)} x2={x(boundary)} y1={padT} y2={H - padB} stroke="var(--border-strong)" strokeWidth="1.5" />
      <text x={x(boundary)} y={padT - 4} textAnchor="middle" fontSize="11" fill="var(--fg-subtle)">
        today
      </text>

      {/* confidence band */}
      {bandPath && <path d={bandPath} fill={color} opacity="0.14" />}

      {/* history */}
      <path d={histArea} fill="url(#histFill)" />
      <path d={histLine} fill="none" stroke={historyColor} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />

      {/* forecast */}
      {fcArea && <path d={fcArea} fill="url(#fcFill)" />}
      <path
        d={fcLine}
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter="url(#dotGlow)"
      />
      {fcOnly.map((p) => {
        const i = series.indexOf(p);
        return (
          <circle
            key={p.date}
            cx={x(i)}
            cy={y(p.value)}
            r="3"
            fill={color}
            stroke="var(--surface)"
            strokeWidth="1.5"
            filter="url(#dotGlow)"
          />
        );
      })}

      {/* x labels */}
      {series.map((p, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text key={p.date} x={x(i)} y={H - padB + 18} textAnchor="middle" fontSize="11" fill="var(--fg-subtle)">
            {p.date.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}

/** Intensity grid — rows × cols, cell shaded by value (0..1). */
export function Heatmap({
  rows,
  cols,
  matrix,
  color,
}: {
  rows: string[];
  cols: string[];
  matrix: number[][]; // rows × cols, values 0..1
  color: string;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[420px]">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `44px repeat(${cols.length}, minmax(0, 1fr))` }}
        >
          <div />
          {cols.map((c) => (
            <div key={c} className="pb-1 text-center text-[10px] font-medium text-fg-subtle">
              {c}
            </div>
          ))}
          {rows.map((r, ri) => (
            <React.Fragment key={r}>
              <div className="flex items-center text-[11px] font-medium text-fg-subtle">{r}</div>
              {cols.map((c, ci) => {
                const v = matrix[ri]?.[ci] ?? 0;
                return (
                  <div
                    key={c}
                    title={`${r} · ${c}: ${Math.round(v * 100)}% of peak`}
                    className="aspect-[2/1] rounded-md border border-border/50"
                    style={{ background: color, opacity: 0.08 + v * 0.92 }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Donut for shares (payment mix, etc). */
export function Donut({
  segments,
  size = 120,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  // Precompute each segment's dash length + cumulative offset (no render-time mutation).
  const arcs = segments.map((s, i) => {
    const dash = (s.value / total) * c;
    const offset = segments.slice(0, i).reduce((a, b) => a + (b.value / total) * c, 0);
    return { ...s, dash, offset };
  });
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0 -rotate-90">
        {arcs.map((s, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${s.dash} ${c - s.dash}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <div className="space-y-1">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-fg-muted">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums">
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
