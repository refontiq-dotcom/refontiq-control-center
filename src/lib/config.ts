import type { SupabaseClient } from "@supabase/supabase-js";

// NOTE SÉCURITÉ : le mot de passe admin vit UNIQUEMENT dans Supabase Auth
// (compte refontiq@gmail.com) et dans `.env.local` (variable
// SUPER_ADMIN_PASSWORD, jamais commitée). Aucun secret ne doit être
// codé en dur dans le dépôt.
export const ADMIN_PWD: string | null = null;

export function getSupabaseAdminUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://pprsngmvrkxbzuvghgef.supabase.co";
}

export function buildAdminLoginUrl() {
  const base = "/api/admin-login";
  return base;
}

export function validateLoginInput(email: string, password: string) {
  const emailOk = typeof email === "string" && email.trim().includes("@");
  const pwdOk = typeof password === "string" && password.length >= 6;
  return emailOk && pwdOk;
}

// ── Helper de session basé sur le cookie JWT (pas de dépendance serveur/client) ──
const COOKIE_PREFIX = "sb-";
const AUTH_TOKEN_COOKIE_RE = new RegExp(
  `${COOKIE_PREFIX}[a-z0-9-]*-auth-token=([^;]+)`
);

/**
 * Retourne le JWT Bearer brut (email + custom_claims) contenu dans le cookie
 * d'authentification `@supabase/ssr` (cookie `sb-*-auth-token`).
 *
 * Ce cookie est posé par `/api/admin-login` (response `set-cookie`) et
 * retransmis automatiquement par le navigateur. Le middleware `@supabase/ssr`
 * ne l'efface pas tant que la session est valide.
 *
 * Usage côté client uniquement (browser). Sortir le décodage hors de Supabase
 * pour éviter les cas où `createClient().getSession()` ne retrouve pas la session
 * côté client juste après le login (problème provider/cookie).
 */
export function getAuthTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie;
  const m = AUTH_TOKEN_COOKIE_RE.exec(cookie);
  if (!m) return null;
  return m[1] ? decodeURIComponent(m[1]) : null;
}

/**
 * Décodage léger d'un JWT (sans crypto, juste pour lecture custom_claims).
 * Retourne { email?: string; role?: string | null } ou null en cas d'échec.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    // Padding base64url
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Test rapide : la session actuelle (via cookie) appartient-elle à un super_admin ?
 *
 * Logique : on lit le cookie `sb-*-auth-token`, on décod le `custom_claims.role`
 * OU on fallback sur l'email `refontiq@gmail.com` (le compte super admin officiel).
 *
 * Cette fonction est stricte : si aucun cookie ou le rôle n'est pas super_admin,
 * retourne false. Elle ne dépend pas de Supabase client.
 */
export function isSuperAdminSession(): boolean {
  if (typeof document === "undefined") return false;
  const token = getAuthTokenFromCookie();
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload) return false;

  const claims = (payload as { app_metadata?: Record<string, unknown> }).app_metadata;
  const role = claims ? (claims as Record<string, unknown>).role : undefined;
  if (role === "super_admin") return true;

  // Fallback : compte par email officiel (refontiq@gmail.com) qui a le rôle super_admin.
  const email = (payload as Record<string, unknown>).email as string | undefined;
  if (email && email.toLowerCase() === "refontiq@gmail.com") return true;

  return false;
}