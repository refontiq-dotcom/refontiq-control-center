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
