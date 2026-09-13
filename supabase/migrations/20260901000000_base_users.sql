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
