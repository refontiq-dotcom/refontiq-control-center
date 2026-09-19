"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Network,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_LOGIN_ROUTE } from "@/lib/routes";

const items = [
  { href: "/admin/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/admin/billing", label: "Paiements centraux", icon: CreditCard },
  { href: "/admin/integration-checklist", label: "Intégration des projets", icon: Network },
  { href: "/admin/trouvetou-traffic", label: "Trafic Trouvetou", icon: TrendingUp },
];

export function AdminSidebar() {
  const pathname = usePathname();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = ADMIN_LOGIN_ROUTE;
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">Refontiq</div>
          <div className="truncate text-[10px] uppercase tracking-wider text-slate-400">Control Center</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Navigation Super Admin">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="mb-3 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <BarChart3 className="h-4 w-4" />
            Super Admin central
          </div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            Un seul centre de pilotage pour tout l'écosystème Refontiq.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200 bg-white lg:hidden">
      <div className="flex gap-1 overflow-x-auto px-3 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
