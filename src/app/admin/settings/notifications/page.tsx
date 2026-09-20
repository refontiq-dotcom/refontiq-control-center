"use client";

import { useEffect, useState } from "react";
import { Bell, Volume2, CreditCard, Database, TrendingUp, ShieldAlert, Info, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Preferences = Record<string, boolean>;

const rows = [
  ["browser_notifications","Notifications navigateur","Recevoir les alertes même lorsque le Control Center est en arrière-plan.",Bell],
  ["sound_enabled","Son des alertes","Jouer un signal sonore pour les alertes autorisées.",Volume2],
  ["critical_alerts","Alertes critiques","Incidents critiques et situations nécessitant une action rapide.",ShieldAlert],
  ["warning_alerts","Alertes importantes","Situations à vérifier sans niveau critique.",Bell],
  ["info_alerts","Informations","Événements informatifs et activité normale.",Info],
  ["payment_alerts","Paiements","Nouvelles demandes ou validations financières en attente.",CreditCard],
  ["sync_alerts","Synchronisation","Échecs, retards ou absence de synchronisation des projets.",Database],
  ["traffic_alerts","Trafic","Signaux importants concernant le trafic de Trouvetou.",TrendingUp],
  ["system_alerts","Système","Alertes techniques du Control Center.",ShieldAlert],
] as const;

export default function NotificationSettingsPage() {
  const [prefs,setPrefs]=useState<Preferences>({});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{fetch("/api/notification-preferences",{cache:"no-store"}).then(r=>r.json()).then(b=>setPrefs(b.preferences||{})).finally(()=>setLoading(false));},[]);

  function toggle(key:string){setPrefs(p=>({...p,[key]:!p[key]}));}
  async function save(){
    setSaving(true);
    try {
      const r=await fetch("/api/notification-preferences",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(prefs)});
      if(!r.ok) throw new Error();
      const b=await r.json(); setPrefs(b.preferences); toast.success("Réglages des notifications enregistrés.");
    } catch { toast.error("Impossible d'enregistrer les réglages."); }
    finally { setSaving(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-6 p-5 md:p-8">
    <div><div className="text-xs font-medium uppercase tracking-widest text-slate-400">Administration</div><h1 className="mt-2 text-2xl font-bold">Réglages des notifications</h1><p className="mt-2 text-sm text-slate-500">Choisissez précisément quelles alertes peuvent déclencher une notification et un son.</p></div>
    <Card className="divide-y divide-slate-100">
      {loading ? <div className="p-8 text-sm text-slate-500">Chargement…</div> : rows.map(([key,title,description,Icon])=><div key={key} className="flex items-center justify-between gap-4 p-4 md:p-5">
        <div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100"><Icon className="h-4 w-4 text-slate-600"/></div><div><div className="text-sm font-semibold">{title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{description}</div></div></div>
        <button type="button" role="switch" aria-checked={!!prefs[key]} onClick={()=>toggle(key)} className={"relative h-6 w-11 shrink-0 rounded-full transition "+(prefs[key]?"bg-slate-950":"bg-slate-200")}><span className={"absolute top-1 h-4 w-4 rounded-full bg-white shadow transition "+(prefs[key]?"left-6":"left-1")}/></button>
      </div>)}
    </Card>
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={()=>window.location.reload()} className="gap-2"><RotateCcw className="h-4 w-4"/>Réinitialiser l'affichage</Button><Button onClick={()=>void save()} disabled={saving} className="gap-2"><Save className="h-4 w-4"/>{saving?"Enregistrement…":"Enregistrer"}</Button></div>
  </main>;
}
