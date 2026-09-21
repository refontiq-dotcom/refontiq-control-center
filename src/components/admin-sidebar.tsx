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
  { href: "/admin/finance/recouvrement", label: "Recouvrement Schooly", icon: ShieldCheck },
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
        "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition",
        active
          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25"
          : "text-sky-900/70 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
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
    <aside className="hidden w-64 shrink-0 border-r border-sky-200/70 bg-sky-100 lg:flex lg:h-full lg:flex-col dark:border-white/[0.06] dark:bg-[#101319]">
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/30">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">Refontiq</div>
          <div className="truncate text-[10px] font-medium uppercase tracking-widest text-blue-600/70 dark:text-blue-400/80">Control Center</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label="Navigation Super Admin">
        <section>
          <div className="px-3.5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sky-900/50 dark:text-slate-400">Vue globale</div>
          <div className="space-y-1">{globalItems.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </section>

        <section>
          <div className="px-3.5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sky-900/50 dark:text-slate-400">Projets</div>
          <div className="space-y-1">{projectItems.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </section>

        <section>
          <div className="px-3.5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sky-900/50 dark:text-slate-400">Supervision</div>
          <div className="space-y-1">{supervisionItems.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </section>

        <section>
          <div className="px-3.5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sky-900/50 dark:text-slate-400">Finance</div>
          <div className="space-y-1">{financeItems.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </section>

        <section>
          <div className="px-3.5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sky-900/50 dark:text-slate-400">Administration</div>
          <div className="space-y-1">{adminItems.map((item) => <NavLink key={item.href} {...item} />)}</div>
        </section>
      </nav>

      <div className="p-3">
        <div className="soft-chip rounded-2xl border border-white/80 bg-white/80 p-4 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
            <BarChart3 className="h-4 w-4 text-blue-600" /> Super Admin central
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
            Un seul centre de pilotage pour tout l&apos;écosystème Refontiq.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-sky-900/70 transition hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Déconnexion
        </button>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  return (
    <div className="border-b border-sky-200/70 bg-sky-100 lg:hidden dark:border-white/[0.06] dark:bg-[#101319]">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-600/30">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Refontiq Control Center</span>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 pb-2">
        {globalItems.map((item) => <NavLink key={item.href} {...item} />)}
        {projectItems.map((item) => <NavLink key={item.href} {...item} />)}
        {supervisionItems.map((item) => <NavLink key={item.href} {...item} />)}
        {financeItems.map((item) => <NavLink key={item.href} {...item} />)}
        {adminItems.map((item) => <NavLink key={item.href} {...item} />)}
      </div>
    </div>
  );
}
