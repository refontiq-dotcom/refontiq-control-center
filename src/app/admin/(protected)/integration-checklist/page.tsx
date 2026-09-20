"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { IntegrationStatus } from "@/lib/integration-checklist";

type ChecklistItem = {
  projet: string;
  item_key: string;
  section: string;
  label: string;
  required: boolean;
  checked: boolean;
  note?: string | null;
};

type Project = {
  id: string;
  name: string;
  accent: string;
  status: IntegrationStatus;
  note?: string | null;
  items: ChecklistItem[];
};

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_started: "Non commencé",
  in_progress: "En cours",
  validated: "Validé",
  blocked: "Bloqué",
};

function statusClass(status: IntegrationStatus) {
  if (status === "validated") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "in_progress") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "blocked") return "bg-red-100 text-red-800 border-red-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function ProjectProgress({ project }: { project: Project }) {
  const total = project.items.length;
  const checked = project.items.filter((item) => item.checked).length;
  const required = project.items.filter((item) => item.required);
  const requiredChecked = required.filter((item) => item.checked).length;
  const percent = total ? Math.round((checked / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{checked}/{total} éléments cochés</span>
        <span>{requiredChecked}/{required.length} obligatoires</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: percent + "%", backgroundColor: project.accent }} />
      </div>
      <div className="text-xs text-slate-500">{percent}% de progression</div>
    </div>
  );
}

export default function IntegrationChecklistPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState("sejoura");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/integration-checklist", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error(data.error || "Impossible de charger la checklist.");
      setProjects(data.projects ?? []);
      if (!(data.projects ?? []).some((project: Project) => project.id === selected)) {
        setSelected(data.projects?.[0]?.id ?? "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger la checklist.");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const current = useMemo(
    () => projects.find((project) => project.id === selected) ?? projects[0],
    [projects, selected]
  );

  async function toggleItem(item: ChecklistItem) {
    setSaving(item.item_key);
    setError(null);
    try {
      const response = await fetch("/api/admin/integration-checklist", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projet: item.projet, itemKey: item.item_key, checked: !item.checked }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mise à jour impossible.");

      setProjects((previous) =>
        previous.map((project) =>
          project.id !== item.projet ? project : {
            ...project,
            status: data.status,
            items: project.items.map((entry) =>
              entry.item_key === item.item_key ? { ...entry, checked: !entry.checked } : entry
            ),
          }
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setSaving(null);
    }
  }

  async function toggleBlocked() {
    if (!current) return;
    setSaving("__status__");
    try {
      const response = await fetch("/api/admin/integration-checklist", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projet: current.id,
          status: current.status === "blocked" ? "in_progress" : "blocked",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mise à jour impossible.");
      setProjects((previous) =>
        previous.map((project) => project.id === current.id ? { ...project, status: data.status } : project)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setSaving(null);
    }
  }

  if (loading && projects.length === 0) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div>
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6" />
            <div>
              <div className="font-semibold text-slate-900">Intégration des projets</div>
              <div className="text-xs text-slate-500">Checklist Refontiq • modèle Séjoura–Schooly</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} className="gap-1">
              <RefreshCw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} /> Actualiser
            </Button>
            <Link href="/admin/dashboard"><Button variant="outline" size="sm">Dashboard</Button></Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href="/admin/dashboard" className="text-xs text-slate-500 hover:underline">← Retour au Control Center</Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-3">Checklist d'intégration</h1>
          <p className="text-sm text-slate-500 mt-1">
            Suivez chaque projet jusqu'à sa validation complète. Les éléments obligatoires doivent être cochés pour obtenir « Validé ».
          </p>
        </div>

        {error && <Card className="p-4 mb-4 border-red-200 bg-red-50"><div className="text-sm text-red-700">{error}</div></Card>}

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          <div className="space-y-3">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelected(project.id)}
                className={"w-full text-left rounded-xl border p-4 bg-white transition " + (selected === project.id ? "ring-2 ring-slate-300" : "hover:bg-slate-50")}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-semibold text-slate-900">{project.name}</span>
                  <Badge className={statusClass(project.status)}>{STATUS_LABELS[project.status]}</Badge>
                </div>
                <ProjectProgress project={project} />
              </button>
            ))}
          </div>

          {current && (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{current.name}</h2>
                  <p className="text-sm text-slate-500 mt-1">Validation d'intégration au Control Center</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusClass(current.status)}>{STATUS_LABELS[current.status]}</Badge>
                  <Button variant="outline" size="sm" onClick={toggleBlocked} disabled={saving !== null}>
                    {current.status === "blocked" ? "Reprendre" : "Bloquer"}
                  </Button>
                </div>
              </div>

              <ProjectProgress project={current} />

              <div className="mt-7 space-y-7">
                {[...new Set(current.items.map((item) => item.section))].map((section) => {
                  const items = current.items.filter((item) => item.section === section);
                  return (
                    <section key={section}>
                      <h3 className="text-sm font-semibold text-slate-800 mb-2">{section}</h3>
                      <div className="rounded-xl border divide-y bg-white">
                        {items.map((item) => (
                          <label key={item.item_key} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              disabled={saving === item.item_key}
                              onChange={() => toggleItem(item)}
                              className="mt-1 h-4 w-4"
                            />
                            <div className="min-w-0 flex-1">
                              <div className={"text-sm " + (item.checked ? "text-slate-500 line-through" : "text-slate-800")}>
                                {item.label}{item.required && <span className="text-red-500 ml-1">*</span>}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{item.required ? "Obligatoire" : "Selon le projet"}</div>
                            </div>
                            {saving === item.item_key ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : item.checked ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-slate-300" />}
                          </label>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="mt-7 rounded-xl border bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-800">Règle de validation</div>
                <p className="text-xs text-slate-500 mt-1">
                  « Validé » est attribué automatiquement lorsque tous les éléments obligatoires sont cochés. Les éléments facultatifs restent suivis sans bloquer la validation.
                </p>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
