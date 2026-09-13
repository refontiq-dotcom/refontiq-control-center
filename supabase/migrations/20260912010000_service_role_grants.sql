-- ============================================================================
-- 20260912010000 — Grants service_role sur les tables metier
-- (fichier d'origine, rétabli pour cohérence git)
-- ============================================================================

COMMIT;

-- Grant sur les tables existantes pour service_role (nécessaire pour les
-- requêtes ADMIN API).
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Standard pour les futurs objets créés par les autres rôles.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
