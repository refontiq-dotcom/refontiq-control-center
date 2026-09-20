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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <div>
            <div className="text-xs font-semibold text-slate-900">Période d'analyse</div>
            <div className="text-[11px] text-slate-500">{label}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPreset("today")} className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">Aujourd'hui</button>
          <button type="button" onClick={() => setPreset("7d")} className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">7 jours</button>
          <button type="button" onClick={() => setPreset("30d")} className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">30 jours</button>
          <button type="button" onClick={() => setPreset("month")} className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">Ce mois</button>
          <button type="button" onClick={() => setPreset("previous-month")} className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">Mois précédent</button>
          <label className="flex items-center gap-1.5 rounded-lg border bg-slate-50 px-2 py-1">
            <span className="text-[10px] text-slate-500">Du</span>
            <input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} className="bg-transparent text-xs outline-none" aria-label="Date de début" />
          </label>
          <label className="flex items-center gap-1.5 rounded-lg border bg-slate-50 px-2 py-1">
            <span className="text-[10px] text-slate-500">au</span>
            <input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className="bg-transparent text-xs outline-none" aria-label="Date de fin" />
          </label>
          {onReset && <button type="button" onClick={onReset} className="text-xs font-medium text-slate-500 underline hover:text-slate-900">Réinitialiser</button>}
        </div>
      </div>
    </div>
  );
}
