"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BedDouble,
  Building2,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Network,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Activity,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_LOGIN_ROUTE } from "@/lib/routes";

const globalItems = [
  { href: "/admin/dashboard", label: "Ensemble", icon: LayoutDashboard },
];

const supervisionItems = [
  { href: "/admin/supervision", label: "Supervision", icon: Activity },
];

const projectItems = [
  { href: "/admin/projects/sejoura", label: "Séjoura", icon: Building2 },
  { href: "/admin/projects/schooly", label: "Schooly", icon: GraduationCap },
  { href: "/admin/projects/trouvetou", label: "Trouvetou", icon: BedDouble },
  { href: "/admin/projects/docly", label: "Docly", icon: Stethoscope },
];

const financeItems = [
  { href: "/admin/finance", label: "Finance & paiements", icon: CreditCard },
];

const adminItems = [
  { href: "/admin/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/integration-checklist", label: "Intégration des projets", icon: Network },
  { href: "/admin/trouvetou-traffic", label: "Trafic Trouvetou", icon: TrendingUp },
];

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: ComponentType<{ className?: string }> }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export function AdminSidebar() {
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = ADMIN_LOGIN_ROUTE;
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white"><ShieldCheck className="h-5 w-5" /></div>
        <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-950">Refontiq</div><div className="truncate text-[10px] uppercase tracking-wider text-slate-400">Control Center</div></div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Navigation Super Admin">
        <section>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Vue globale</div>
          <div className="space-y-1">{globalItems.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </section>

        <section>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Projets</div>
          <div className="space-y-1">{projectItems.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </section>

        <section>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Supervision</div>
          <div className="space-y-1">{supervisionItems.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </section>

        <section>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Finance</div>
          <div className="space-y-1">{financeItems.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </section>

        <section>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Administration</div>
          <div className="space-y-1">{adminItems.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </section>
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="mb-3 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><BarChart3 className="h-4 w-4" /> Super Admin central</div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">Un seul centre de pilotage pour tout l'écosystème Refontiq.</p>
        </div>
        <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950">
          <LogOut className="h-4 w-4" /> Déconnexion
        </button>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  return (
    <div className="border-b border-slate-200 bg-white lg:hidden">
      <div className="flex gap-1 overflow-x-auto px-3 py-2">
        {globalItems.map((item) => <NavLink key={item.href} {...item} />)}
        {projectItems.map((item) => <NavLink key={item.href} {...item} />)}
        {supervisionItems.map((item) => <NavLink key={item.href} {...item} />)}
        {financeItems.map((item) => <NavLink key={item.href} {...item} />)}
        {adminItems.map((item) => <NavLink key={item.href} {...item} />)}
      </div>
    </div>
  );
}
