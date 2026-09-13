-- ============================================================================
-- Refontiq Control Center — Nettoyage de l'ancienne portfolio_metrics (mai 2026).
-- L'ancienne structure (product_id, name, active_tenants, health_status,
-- last_push_at) n'est plus référencée par aucun code actuel : le dashboard et
-- /api/metrics/push attendent (projet, nom, mrr, comptes_actifs, statut_sante,
-- derniere_synchro). La table est recrée au bon format par la migration
-- 20260902000000_portfolio_metrics.sql (seed inclus).
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================================

DROP TABLE IF EXISTS portfolio_metrics CASCADE;
