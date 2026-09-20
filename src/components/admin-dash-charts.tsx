"use client";

import type { ReactNode } from "react";

/* ---------- helpers ---------- */

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    d += ` C${mx.toFixed(2)},${p0.y.toFixed(2)} ${mx.toFixed(2)},${p1.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
  }
  return d;
}

/* ---------- sparkline (hero) ---------- */

export function MiniSparkline({
  values,
  width = 210,
  height = 56,
  stroke = "#ffffff",
  fillOpacity = 0.22,
  id,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fillOpacity?: number;
  id: string;
}) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((v, i) => ({
    x: i * step,
    y: 4 + (1 - (v - min) / span) * (height - 8),
  }));
  const line = smoothPath(points);
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${id}-fill)`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="4" fill="#fff" />
      <circle cx={last.x} cy={last.y} r="2" fill="#2563eb" />
    </svg>
  );
}

/* ---------- donut ---------- */

export function DonutChart({
  data,
  size = 170,
  thickness = 26,
  centerLabel,
  centerValue,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
  centerLabel: string;
  centerValue: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  const segments: Array<{ color: string; dash: number; offset: number }> = [];
  let cursor = 0;
  for (const d of data) {
    const frac = d.value / total;
    const dash = Math.max(0, frac * c - 3);
    segments.push({ color: d.color, dash, offset: cursor });
    cursor += frac * c;
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((segment, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={`${segment.dash} ${c - segment.dash}`}
              strokeDashoffset={-segment.offset}
              strokeLinecap="butt"
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-900">{centerValue}</span>
        <span className="text-[11px] text-slate-500">{centerLabel}</span>
      </div>
    </div>
  );
}

/* ---------- grouped bars (income vs spending style) ---------- */

export function GroupedBars({
  groups,
  series,
  height = 170,
  yTicks = 4,
}: {
  groups: string[];
  series: Array<{ label: string; color: string; values: number[] }>;
  height?: number;
  yTicks?: number;
}) {
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const scale = (v: number) => Math.max(3, Math.round((v / max) * (height - 34)));

  return (
    <div>
      <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-3">
        <div className="flex flex-col justify-between pb-5 text-right text-[10px] text-slate-400" style={{ height }}>
          {Array.from({ length: yTicks + 1 }).map((_, i) => (
            <span key={i}>{formatCompact(Math.round((max * (yTicks - i)) / yTicks))}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 34 }}>
            {Array.from({ length: yTicks + 1 }).map((_, i) => (
              <span key={i} className="block h-px w-full bg-slate-100" />
            ))}
          </div>
          <div className="relative flex items-end justify-between gap-1" style={{ height: height - 34 }}>
            {groups.map((g, gi) => (
              <div key={g} className="flex h-full flex-1 items-end justify-center gap-[3px]">
                {series.map((s) => (
                  <div
                    key={s.label}
                    className="w-2.5 rounded-t-[4px] transition-all"
                    style={{ height: scale(s.values[gi] ?? 0), backgroundColor: s.color, opacity: 0.92 }}
                    title={`${s.label} • ${g} : ${formatCompact(s.values[gi] ?? 0)}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between gap-1">
            {groups.map((g) => (
              <span key={g} className="flex-1 text-center text-[10px] text-slate-400">
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- area + line (investment performance style) ---------- */

export function AreaChart({
  values,
  width = 560,
  height = 90,
  stroke = "#10b981",
  id,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  id: string;
}) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((v, i) => ({
    x: i * step,
    y: 5 + (1 - (v - min) / span) * (height - 10),
  }));
  const line = smoothPath(points);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      height={height}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${id}-fill)`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- round progress (objectifs style) ---------- */

export function RoundProgress({
  value,
  size = 44,
  stroke = 5,
  color = "#6366f1",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">{label}</span>
    </div>
  );
}

/* ---------- misc ---------- */

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)} k`;
  return String(Math.round(value));
}

export function IconTile({
  children,
  bg,
  className = "",
}: {
  children: ReactNode;
  bg: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${className}`}
      style={{ backgroundColor: bg }}
    >
      {children}
    </span>
  );
}
