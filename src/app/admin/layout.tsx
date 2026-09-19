import type { ReactNode } from "react";
import { AdminMobileNav, AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="min-w-0 flex-1">
          <AdminMobileNav />
          {children}
        </div>
      </div>
    </div>
  );
}
