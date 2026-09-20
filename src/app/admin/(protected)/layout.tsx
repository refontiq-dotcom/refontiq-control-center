import type { ReactNode } from "react";
import { AdminMobileNav, AdminSidebar } from "@/components/admin-sidebar";

export default function AdminProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="soft-canvas h-[100dvh] overflow-hidden p-2.5 md:p-4">
      <div className="mx-auto flex h-full w-full max-w-[1700px] overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_60px_-30px_rgba(65,84,158,0.45)]">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-white">
          <AdminMobileNav />
          {children}
        </div>
      </div>
    </div>
  );
}
