import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_BODY_BYTES,
  checkCollectionTime,
  parseMetricsPayload,
} from "@/lib/contracts/metrics-v1";
import { storeMetrics } from "@/lib/metrics/store";
import { bearerToken, safeEqual } from "@/lib/security/safe-equal";

// ============================================================================
// POST /api/metrics/push — réception des métriques d'un SaaS (contrat v1).
// Définition complète : docs/contracts/metrics-push-v1.md
//
// Réponses : toute erreur porte un `code` stable et lisible par machine.
//   401 unauthorized · 503 receiver_not_configured · 413 payload_too_large
//   400 invalid_json | invalid_payload | invalid_details
//   422 future_payload | stale_payload | environment_not_accepted
//   500 storage_failed | history_failed (metric_stored indique l'état partiel)
//   200 status = stored | history_only | duplicate
// ============================================================================

const fail = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error: code, code, ...extra }, { status });

export async function POST(req: Request) {
  // Lu à chaque requête (et non au chargement du module) : une rotation de secret
  // ou un test n'exige pas de redémarrage.
  const secret = process.env.METRICS_PUSH_SECRET?.trim();
  if (!secret) return fail(503, "receiver_not_configured");

  const token = bearerToken(req.headers.get("authorization"));
  if (!token || !safeEqual(token, secret)) return fail(401, "unauthorized");

  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return fail(413, "payload_too_large");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "invalid_json");
  }

  const receivedAt = new Date();
  const parsed = parseMetricsPayload(body, receivedAt);
  if (!parsed.ok) return fail(400, parsed.code, { issues: parsed.issues });
  const m = parsed.data;

  // Un aperçu ou un poste de développement ne doit jamais écraser la production.
  if (m.environment !== "production") {
    return fail(422, "environment_not_accepted", { environment: m.environment });
  }

  const time = checkCollectionTime(m.collectedAt, receivedAt);
  if (!time.ok) return fail(422, time.code, { message: time.message });

  try {
    const outcome = await storeMetrics(createAdminClient(), m, receivedAt);

    if (!outcome.ok) {
      console.error("[metrics.push] stockage en échec", { projet: m.projet, code: outcome.code });
      return fail(500, outcome.code, {
        metric_stored: outcome.metricStored,
        retryable: true,
        message:
          outcome.code === "history_failed"
            ? "Valeur courante enregistrée mais historique indisponible : renvoyer le même envoi (même run_id)."
            : "Enregistrement impossible : renvoyer le même envoi.",
      });
    }

    return NextResponse.json({
      ok: true,
      success: true, // conservé pour les anciens émetteurs
      status: outcome.status,
      projet: m.projet,
      contract_version: m.contractVersion,
      collected_at: m.collectedAt.toISOString(),
      collected_at_source: m.collectedAtSource,
      received_at: receivedAt.toISOString(),
      schema: outcome.schema,
      warnings: outcome.warnings,
    });
  } catch (err) {
    console.error("[metrics.push] erreur inattendue", { projet: m.projet, name: (err as Error)?.name });
    return fail(500, "internal_error", { retryable: true });
  }
}
