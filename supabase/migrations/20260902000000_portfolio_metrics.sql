-- ============================================================================
-- Refontiq Control Center — Table portfolio_metrics (Tâche 0.2 §3).
-- Vue consolidée : UNE ligne par produit (projet UNIQUE).
-- Colonnes imposées : projet, nom, mrr, comptes_actifs, statut_sante,
-- derniere_synchro. Upsert via POST /api/metrics/push (clé partagée).
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet            TEXT NOT NULL UNIQUE CHECK (projet <> ''),
  nom               TEXT NOT NULL,
  mrr               INTEGER NOT NULL DEFAULT 0 CHECK (mrr >= 0),
  comptes_actifs    INTEGER NOT NULL DEFAULT 0 CHECK (comptes_actifs >= 0),
  statut_sante      TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (statut_sante IN ('healthy', 'warning', 'critical', 'unknown')),
  derniere_synchro  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_metrics_projet
  ON portfolio_metrics(projet);
CREATE INDEX IF NOT EXISTS idx_portfolio_metrics_synchro
  ON portfolio_metrics(derniere_synchro DESC);

DROP TRIGGER IF EXISTS trigger_portfolio_metrics_updated ON portfolio_metrics;
CREATE TRIGGER trigger_portfolio_metrics_updated
  BEFORE UPDATE ON portfolio_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS : seul le Super Admin lit (l'écriture passe par service_role) ──────
ALTER TABLE portfolio_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_metrics_select_super_admin" ON portfolio_metrics;
CREATE POLICY "portfolio_metrics_select_super_admin" ON portfolio_metrics
  FOR SELECT USING (is_super_admin());

-- ── Seed : lignes initiales (noms affichés avant le premier push) ──────────
INSERT INTO portfolio_metrics (projet, nom, mrr, comptes_actifs, statut_sante)
VALUES
  ('sejoura', 'Séjoura', 0, 0, 'unknown'),
  ('docly', 'Docly', 0, 0, 'unknown'),
  ('schooly', 'Schooly', 0, 0, 'unknown')
ON CONFLICT (projet) DO NOTHING;
