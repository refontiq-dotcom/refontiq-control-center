"use client";

import { CalendarDays } from "lucide-react";
import { useMemo } from "react";

export type PeriodRange = {
  from: string;
  to: string;
};

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value + "T00:00:00")
  );
}

function isoDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA").format(date);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function getPresetRange(preset: "today" | "7d" | "30d" | "month" | "previous-month"): PeriodRange {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") return { from: isoDate(end), to: isoDate(end) };
  if (preset === "7d") {
    const from = new Date(end);
    from.setDate(from.getDate() - 6);
    return { from: isoDate(from), to: isoDate(end) };
  }
  if (preset === "30d") {
    const from = new Date(end);
    from.setDate(from.getDate() - 29);
    return { from: isoDate(from), to: isoDate(end) };
  }
  if (preset === "previous-month") {
    const previous = new Date(end.getFullYear(), end.getMonth() - 1, 1);
    return { from: isoDate(startOfMonth(previous)), to: isoDate(endOfMonth(previous)) };
  }
  return { from: isoDate(startOfMonth(end)), to: isoDate(end) };
}

export function AdminPeriodFilter({
  value,
  onChange,
  onReset,
}: {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
  onReset?: () => void;
}) {
  const label = useMemo(() => {
    if (!value.from || !value.to) return "Période";
    return value.from === value.to ? formatDate(value.from) : `${formatDate(value.from)} → ${formatDate(value.to)}`;
  }, [value]);

  function setPreset(preset: "today" | "7d" | "30d" | "month" | "previous-month") {
    onChange(getPresetRange(preset));
  }

  const presets: Array<{ key: "today" | "7d" | "30d" | "month" | "previous-month"; label: string }> = [
    { key: "today", label: "Aujourd'hui" },
    { key: "7d", label: "7 jours" },
    { key: "30d", label: "30 jours" },
    { key: "month", label: "Ce mois" },
    { key: "previous-month", label: "Mois précédent" },
  ];
  const isActivePreset = (key: (typeof presets)[number]["key"]) => {
    const preset = getPresetRange(key);
    return preset.from === value.from && preset.to === value.to;
  };

  return (
    <div className="soft-card rounded-3xl border border-white/70 bg-white/80 p-3 backdrop-blur">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <div className="text-xs font-semibold text-slate-900">Période d&apos;analyse</div>
            <div className="text-[11px] text-slate-500">{label}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((preset) => {
            const active = isActivePreset(preset.key);
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => setPreset(preset.key)}
                className={
                  active
                    ? "rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/25"
                    : "rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900"
                }
              >
                {preset.label}
              </button>
            );
          })}
          <label className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200">
            <span className="text-[10px] text-slate-500">Du</span>
            <input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} className="bg-transparent text-xs outline-none" aria-label="Date de début" />
          </label>
          <label className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200">
            <span className="text-[10px] text-slate-500">au</span>
            <input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className="bg-transparent text-xs outline-none" aria-label="Date de fin" />
          </label>
          {onReset && <button type="button" onClick={onReset} className="rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">Réinitialiser</button>}
        </div>
      </div>
    </div>
  );
}
