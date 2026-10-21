-- ============================================================================
-- Contrat de métriques v1 — colonnes de provenance et idempotence
--
-- ÉTAT : PRÉPARÉE, NON APPLIQUÉE. Ne pas lancer sans autorisation explicite.
--
-- Objectif : conserver, pour chaque envoi, ce que le contrat v1 apporte
--   * contract_version : 0 = ancien format, 1 = contrat v1
--   * environment      : environnement de l'émetteur (seul « production » est accepté)
--   * received_at      : date de RÉCEPTION (distincte de la date de COLLECTE, déjà
--                        portée par derniere_synchro / captured_at)
--   * run_id           : identifiant d'exécution de l'émetteur → idempotence
--
-- Impact : ajout de colonnes avec valeur par défaut (aucune réécriture destructive,
-- aucune donnée existante modifiée) + un index unique PARTIEL (run_id non nul), donc
-- sans effet sur les lignes historiques.
--
-- Compatibilité : le récepteur fonctionne AUSSI sans cette migration (mode « legacy »
-- signalé dans la réponse par schema:"legacy" et un avertissement schema_outdated) :
-- l'ordre de déploiement n'est donc pas critique, mais l'idempotence par run_id et la
-- provenance ne sont garanties qu'après application.
--
-- Rejouable : oui (IF NOT EXISTS partout).
-- Validation après application :
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name IN ('portfolio_metrics','portfolio_metric_snapshots')
--     AND column_name IN ('contract_version','environment','received_at','last_run_id','run_id');
--   -- attendu : 3 colonnes sur portfolio_metrics (contract_version, environment,
--   --           received_at, last_run_id = 4) et 4 sur snapshots (…, run_id)
-- Retour arrière : ALTER TABLE … DROP COLUMN IF EXISTS … ; DROP INDEX IF EXISTS …
-- ============================================================================

alter table public.portfolio_metrics
  add column if not exists contract_version integer not null default 0 check (contract_version >= 0),
  add column if not exists environment text not null default 'production',
  add column if not exists received_at timestamptz,
  add column if not exists last_run_id uuid;

alter table public.portfolio_metric_snapshots
  add column if not exists contract_version integer not null default 0 check (contract_version >= 0),
  add column if not exists environment text not null default 'production',
  add column if not exists received_at timestamptz,
  add column if not exists run_id uuid;

-- Un même run_id ne peut être enregistré qu'une fois par produit.
create unique index if not exists portfolio_metric_snapshots_run_uidx
  on public.portfolio_metric_snapshots (projet, run_id)
  where run_id is not null;
