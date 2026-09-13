-- ============================================================================
-- 20260913000000 — GRANT SELECT sur public.users pour le rôle authenticated.
-- (Correction du 403 sur /admin/dashboard causé par le middleware et le
-- client anon vérifiant role + is_active.)

GRANT SELECT ON public.users TO authenticated;
