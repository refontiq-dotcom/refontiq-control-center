-- ============================================================================
-- Refontiq Control Center — Grants service_role.
-- Les tables creees par migrations n'ont aucun GRANT explicite ; sur le projet
-- remote, service_role (PostgREST) ne peut donc ni lire ni ecrire -> les
-- endpoints /api/metrics/push (upsert) et /api/metrics (lecture admin)
-- renvoient 500/403. Ces GRANTs sont requis pour le push des produits
-- (Schooly, Sejoura, ...) via la cle partagee METRICS_PUSH_SECRET.
-- Idempotent : GRANT est re-executable sans erreur.
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Defaut pour les futurs objets
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
