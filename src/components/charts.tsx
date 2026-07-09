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
