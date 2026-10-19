import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================================
// Garde d'accès Super Admin pour les routes API du Control Center.
//
// Le middleware ne protège que /admin/* : chaque route /api/* doit donc
// s'authentifier elle-même, côté serveur, via ce garde.
//
// - L'identité vient de supabase.auth.getUser(), qui valide le jeton auprès du
//   serveur d'authentification. getSession() ne le fait pas : il se contente de
//   décoder le cookie, qui ne prouve donc rien côté serveur.
// - Échec FERMÉ : toute erreur de lecture du profil refuse l'accès.
// - 401 = non authentifié ; 403 = authentifié mais pas Super Admin actif.
// ============================================================================

export type SuperAdminContext = {
  /** Identifiant dans auth.users. */
  authUserId: string;
  /** Identifiant dans public.users. */
  userId: string;
};

export type SuperAdminResult =
  | { ok: true; admin: SuperAdminContext }
  | { ok: false; response: NextResponse };

export async function requireSuperAdmin(): Promise<SuperAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non authentifié." }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("users")
    .select("id, role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[requireSuperAdmin] lecture du profil impossible:", error.message);
    return {
      ok: false,
      response: NextResponse.json({ error: "Vérification des droits impossible." }, { status: 500 }),
    };
  }

  if (!profile || profile.role !== "super_admin" || profile.is_active === false) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Accès non autorisé." }, { status: 403 }),
    };
  }

  return { ok: true, admin: { authUserId: user.id, userId: profile.id } };
}
