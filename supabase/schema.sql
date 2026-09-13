-- ============================================================================
-- REFONTIQ CONTROL CENTER — Schéma de Base de Données
-- Hub Super Admin unifié pour piloter tous les produits Refontiq
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLE: users (Super Admins uniquement)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id    UUID UNIQUE, -- Référence vers auth.users (Supabase Auth)
  role            TEXT NOT NULL DEFAULT 'super_admin' CHECK (role = 'super_admin'),
  full_name       TEXT NOT NULL,
  email           TEXT UNIQUE,
  phone           TEXT,
  password_hash   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_auth ON users(auth_user_id);
CREATE INDEX idx_users_email ON users(email);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 2. TABLE: portfolio_metrics (Métriques consolidées par produit)
-- ----------------------------------------------------------------------------
CREATE TABLE portfolio_metrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projet          TEXT NOT NULL UNIQUE, -- ex: 'sejoura', 'schooly', 'docly', 'trouvetou'
  nom             TEXT NOT NULL,        -- Nom affiché
  mrr             BIGINT NOT NULL DEFAULT 0,     -- Monthly Recurring Revenue en FCFA
  comptes_actifs  INTEGER NOT NULL DEFAULT 0,
  statut_sante    TEXT NOT NULL DEFAULT 'unknown' CHECK (statut_sante IN ('healthy', 'warning', 'critical', 'unknown')),
  derniere_synchro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_portfolio_metrics_updated BEFORE UPDATE ON portfolio_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3. FONCTION: is_super_admin()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid() AND role = 'super_admin' AND is_active
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_metrics ENABLE ROW LEVEL SECURITY;

-- users: seul le super_admin connecté peut lire son propre profil
CREATE POLICY "users_select_self" ON users
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "users_update_self" ON users
  FOR UPDATE USING (auth_user_id = auth.uid());

-- portfolio_metrics: lecture seule pour super_admin
CREATE POLICY "portfolio_metrics_select_super_admin" ON portfolio_metrics
  FOR SELECT USING (is_super_admin());

-- Insertion/Update via l'API avec clé partagée (service role)
CREATE POLICY "portfolio_metrics_service_role" ON portfolio_metrics
  FOR ALL USING (true); -- L'API utilise le service role key

-- ----------------------------------------------------------------------------
-- 5. DONNÉES INITIALES (à exécuter manuellement après création du super admin)
-- ----------------------------------------------------------------------------
-- INSERT INTO portfolio_metrics (projet, nom, mrr, comptes_actifs, statut_sante) VALUES
--   ('sejoura', 'Séjoura', 0, 0, 'unknown'),
--   ('schooly', 'Schooly', 0, 0, 'unknown'),
--   ('docly', 'Docly', 0, 0, 'unknown'),
--   ('trouvetou', 'Trouvetou', 0, 0, 'unknown');
