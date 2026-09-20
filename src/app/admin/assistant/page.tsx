"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const suggestions = [
  "Qu'est-ce qui nécessite mon attention aujourd'hui ?",
  "Pourquoi le revenu consolidé est-il à ce niveau ?",
  "Quel projet a les données les moins fraîches ?",
  "Y a-t-il des paiements qui nécessitent une décision ?",
];

export default function AssistantPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState<"ai" | "deterministic" | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer("");
    try {
      const response = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await response.json();
      setAnswer(data.answer ?? "Aucune réponse disponible.");
      setMode(data.mode ?? "deterministic");
    } catch {
      setAnswer("Impossible de contacter le copilote pour le moment.");
      setMode("deterministic");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400"><Bot className="h-4 w-4" /> Copilote Refontiq</div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Posez une question au Control Center</h1>
          <p className="mt-1 text-sm text-slate-500">Le copilote travaille sur les métriques centralisées et signale clairement les données manquantes ou anciennes.</p>
        </div>

        <Card className="border-slate-200 p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-slate-500" /><div><h2 className="font-semibold">Questions rapides</h2><p className="text-xs text-slate-500">Elles utilisent uniquement les données du Control Center.</p></div></div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {suggestions.map((item) => (
              <button key={item} type="button" onClick={() => setQuestion(item)} className="rounded-xl border p-3 text-left text-sm text-slate-700 hover:bg-slate-50">{item}</button>
            ))}
          </div>
        </Card>

        <Card className="border-slate-200 p-5">
          <form onSubmit={ask}>
            <label htmlFor="question" className="text-sm font-medium">Votre question</label>
            <div className="mt-2 flex gap-2">
              <input id="question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex. Qu'est-ce qui nécessite mon attention ?" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400" />
              <Button type="submit" disabled={!question.trim() || loading} className="gap-2"><Send className="h-4 w-4" /> {loading ? "Analyse…" : "Analyser"}</Button>
            </div>
          </form>
        </Card>

        {answer && (
          <Card className="border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" /> Réponse</div><span className="text-[10px] uppercase tracking-widest text-slate-400">{mode === "ai" ? "IA + données" : "données déterministes"}</span></div>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{answer}</div>
          </Card>
        )}
      </div>
    </main>
  );
}
