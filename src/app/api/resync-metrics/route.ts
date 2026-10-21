import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin";

// Cette route répondait « success / queued » sans rien déclencher, et sans
// authentification : un faux succès exploitable par n'importe qui.
//
// Elle est désormais réservée au Super Admin et répond HONNÊTEMENT 501 tant que
// le déclenchement réel (appel authentifié du produit cible, avec suivi de la
// commande) n'est pas implémenté — voir le lot « pilotage sécurisé ».
export async function POST() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      success: false,
      status: "not_implemented",
      error: "La re-synchronisation à la demande n'est pas encore disponible.",
    },
    { status: 501 }
  );
}
