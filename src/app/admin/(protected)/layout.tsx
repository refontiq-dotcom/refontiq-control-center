import type { ReactNode } from "react";
import { AdminMobileNav, AdminSidebar } from "@/components/admin-sidebar";

export default function AdminProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="soft-canvas h-[100dvh] overflow-hidden p-2.5 md:p-4">
      <div className="mx-auto flex h-full w-full max-w-[1700px] overflow-hidden rounded-3xl border border-sky-200/70 bg-sky-100 shadow-[0_24px_60px_-30px_rgba(30,64,175,0.35)]">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-sky-100">
          <AdminMobileNav />
          {children}
        </div>
      </div>
    </div>
  );
}
