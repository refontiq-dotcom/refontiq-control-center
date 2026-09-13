-- ============================================================================
-- 20260913000000 — Table telegram_alerts (Control Center)
-- Journal des alertes Telegram envoyées/simulées depuis le dashboard Réglages.
-- Colonnes alignées sur le schéma attendu par /admin/dashboard :
--   id, type, message, created_at (+ level/title alias pour la branche démo).
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.telegram_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level       TEXT NOT NULL DEFAULT 'info'
              CHECK (level IN ('info', 'warning', 'critical', 'success')),
  type        TEXT NOT NULL DEFAULT 'info',
  title       TEXT,
  message     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'sent',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_alerts_created
  ON public.telegram_alerts(created_at DESC);

-- RLS : seul le Super Admin lit / écrit (le service_role écrit aussi, bypass RLS)
ALTER TABLE public.telegram_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_alerts_select_super_admin" ON public.telegram_alerts;
CREATE POLICY "telegram_alerts_select_super_admin" ON public.telegram_alerts
  FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "telegram_alerts_insert_super_admin" ON public.telegram_alerts;
CREATE POLICY "telegram_alerts_insert_super_admin" ON public.telegram_alerts
  FOR INSERT WITH CHECK (is_super_admin());