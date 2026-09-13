-- ============================================================================
-- Refontiq Control Center — SCHEMA CONSOLIDE (generé depuis supabase/migrations/)
--
-- ⚠️  DÉJÀ APPLIQUÉ sur le projet remote pprsngmvrkxbzuvghgef
--     (verifié : supabase db push --dry-run → "Remote database is up to date")
--
-- Usage : uniquement pour RECONSTRUIRE le schéma sur un projet Supabase NEUF
--         (ex. production). Idempotent — re-exécutable sans erreur.
--
-- Ordre (obligatoire) :
--   1. base_users            → table users + helpers + trigger auth
--   2. portfolio_metrics     → métriques consolidées + seed 3 produits
--   3. payment_validations   → demandes de paiement + RPC validate/reject
--   4. service_role_grants   → GRANT service_role (push métriques)
--
-- Ne PAS rejouer 20260901200000_drop_legacy_portfolio_metrics.sql sur un
-- projet neuf : c'est un nettoyage one-off de l'ancienne table (mai 2026).
-- ============================================================================


-- ══════════════════════ SECTION 1/4 : 20260901000000_base_users.sql ══════════════════════

-- ============================================================================
-- Refontiq Control Center — Schéma de base (projet NEUTRE).
-- Extraction des patterns Séjoura (Tâche 0.2), adaptés au périmètre neutre :
--   1. Table users minimale (profil Super Admin lié à Supabase Auth)
--   2. Helpers is_super_admin(), update_updated_at_column()
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================================

-- ── 1. Table users (profil lié à auth.users) ────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  UUID UNIQUE,
  email         TEXT,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'super_admin'
                CHECK (role IN ('super_admin')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Trigger updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated ON users;
CREATE TRIGGER trigger_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 3. Helper is_super_admin() ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_super_admin" ON users;
CREATE POLICY "users_select_super_admin" ON users
  FOR SELECT USING (is_super_admin());

-- ── 5. Trigger handle_new_user : crée le profil depuis auth.users ───────────
-- Rôle issu de raw_user_meta_data.role (posé par create-super-admin.mjs).
-- Contrainte CHECK : seuls 'super_admin' existent dans ce projet neutre.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Super Admin'),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', '') = 'super_admin' THEN 'super_admin'
      ELSE 'super_admin'
    END,
    TRUE
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ══════════════════════ SECTION 2/4 : 20260902000000_portfolio_metrics.sql ══════════════════════

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

-- ══════════════════════ SECTION 3/4 : 20260903000000_payment_validations.sql ══════════════════════

-- ============================================================================
-- Refontiq Control Center — Validation des paiements (Option C, Tâche 0.2).
-- DUPLICATION du pattern Séjoura subscription_payment_requests + RPC
-- validate/reject (cf. 20260812_subscription_manual_payment_flow.sql +
-- 20260818_reject_subscription_payment.sql + sender_phone), adaptée au
-- périmètre NEUTRE multi-produits :
--   + colonne `produit` (sejoura | schooly | docly) : quel SaaS a émis la demande
--   + colonne `produit_ref` (tenant_id / school_id / clinic_id côté produit)
--   + pas de FK vers tenants/subscriptions (bases séparées, jamais fusionnées)
-- La validation métier (activer l'abonnement) reste exécutée côté produit
-- via son API interne ; le Control Center trace la décision + notifie Telegram.
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_validation_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit         TEXT NOT NULL CHECK (produit IN ('sejoura', 'schooly', 'docly')),
  produit_ref     TEXT,
  plan            TEXT NOT NULL,
  amount          INTEGER NOT NULL CHECK (amount >= 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'validated', 'rejected')),
  requested_by    TEXT,
  sender_phone    TEXT,
  validated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payval_produit
  ON payment_validation_requests(produit);
CREATE INDEX IF NOT EXISTS idx_payval_status
  ON payment_validation_requests(status);
CREATE INDEX IF NOT EXISTS idx_payval_created
  ON payment_validation_requests(created_at DESC);

DROP TRIGGER IF EXISTS trigger_payval_updated ON payment_validation_requests;
CREATE TRIGGER trigger_payval_updated
  BEFORE UPDATE ON payment_validation_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS : seul le Super Admin lit/modifie ──────────────────────────────────
ALTER TABLE payment_validation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payval_select_super_admin" ON payment_validation_requests;
CREATE POLICY "payval_select_super_admin" ON payment_validation_requests
  FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "payval_update_super_admin" ON payment_validation_requests;
CREATE POLICY "payval_update_super_admin" ON payment_validation_requests
  FOR UPDATE USING (is_super_admin());

-- ── RPC : valider (Super Admin uniquement) ──────────────────────────────────
CREATE OR REPLACE FUNCTION validate_payment_request(p_request_id UUID)
RETURNS payment_validation_requests AS $$
DECLARE
  v_request payment_validation_requests;
  v_admin_user_id UUID;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Seul le Super Admin peut valider un paiement';
  END IF;

  SELECT * INTO v_request
  FROM payment_validation_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: Demande introuvable ou déjà traitée';
  END IF;

  SELECT id INTO v_admin_user_id
  FROM users
  WHERE auth_user_id = auth.uid() AND role = 'super_admin'
  LIMIT 1;

  UPDATE payment_validation_requests
  SET status = 'validated', validated_by = v_admin_user_id, validated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC : rejeter (Super Admin uniquement) ──────────────────────────────────
CREATE OR REPLACE FUNCTION reject_payment_request(p_request_id UUID)
RETURNS payment_validation_requests AS $$
DECLARE
  v_request payment_validation_requests;
  v_admin_user_id UUID;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Seul le Super Admin peut rejeter un paiement';
  END IF;

  SELECT * INTO v_request
  FROM payment_validation_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: Demande introuvable ou déjà traitée';
  END IF;

  SELECT id INTO v_admin_user_id
  FROM users
  WHERE auth_user_id = auth.uid() AND role = 'super_admin'
  LIMIT 1;

  UPDATE payment_validation_requests
  SET status = 'rejected', validated_by = v_admin_user_id, validated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════ SECTION 4/4 : 20260912000000_service_role_grants.sql ══════════════════════

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
