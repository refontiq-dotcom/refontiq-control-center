"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { isSuperAdminSession } from "@/lib/config";
import { ADMIN_HUB_ROUTE, ADMIN_LOGIN_ROUTE } from "@/lib/routes";

export default function SuperAdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center" style={{ color: "#0f172a" }}>
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <SuperAdminLoginContent />
    </Suspense>
  );
}

function SuperAdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const ACCENT = "#0C1C33";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Vérification orientée cookie JWT (évite le cas où
        // `createClient().getSession()` ne retrouve pas la session
        // côté client juste après /api/admin-login).
        if (cancelled) return;
        if (isSuperAdminSession()) {
          const next = searchParams.get("next");
          const target = next && next.startsWith("/admin/") ? next : ADMIN_HUB_ROUTE;
          router.replace(target);
        }
      } catch {}
    })();
    // Garder le timeout de focus si pas de session, indépendant du chargement.
    const t = setTimeout(() => {
      if (!loading && passwordRef.current) passwordRef.current.focus();
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [router, searchParams]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      setError("");
      if (!password.trim()) {
        setError("Saisissez votre mot de passe.");
        return;
      }
      setLoading(true);
      try {
        const next = searchParams.get("next");
        const res = await fetch(
          `/api/admin-login${next ? "?next=" + encodeURIComponent(next) : ""}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || "Impossible de se connecter. Réessayez.");
          return;
        }
        toast.success("Connexion réussie.");
        window.location.href = (next && next.startsWith("/admin/")) ? next : ADMIN_HUB_ROUTE;
      } catch {
        setError("Une erreur inattendue est survenue.");
      } finally {
        setLoading(false);
      }
    },
    [loading, password, searchParams]
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-[#08090c] dark:text-slate-100">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3 justify-center mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
            style={{ backgroundColor: ACCENT, color: "white", boxShadow: `0 6px 14px ${ACCENT}33` }}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Console Super Admin
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
              Accès réservé à l&apos;administration Refontiq
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 dark:border-white/[0.08] dark:bg-[#050608] dark:shadow-[0_16px_32px_-20px_rgba(0,0,0,0.9)]">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="admin-password" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 dark:text-slate-400">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  ref={passwordRef}
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Votre mot de passe"
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs font-medium rounded-lg px-3 py-2 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full h-12 rounded-xl text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              style={{ backgroundColor: ACCENT, border: "none" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Connexion en cours...
                </>
              ) : (
                "Accéder à la console"
              )}
            </Button>
          </form>
        </div>

        <p className="text-xs text-slate-400 text-center leading-relaxed dark:text-slate-500">
          Ce portail centralise l&apos;administration de tous les produits Refontiq : Séjoura, Schooly, Docly, Trouvetou et les projets à venir.
        </p>
      </div>
    </div>
  );
}
