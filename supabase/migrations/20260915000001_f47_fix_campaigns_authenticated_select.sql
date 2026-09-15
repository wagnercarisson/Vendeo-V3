-- F47-08 forward fix: restaura SELECT em public.campaigns para o role authenticated.
--
-- Causa histórica: 20260708000001_create_campaigns_table.sql concedeu
-- SELECT para authenticated (necessário para a RLS funcionar), mas
-- 20260710000001_grant_service_role_on_campaigns.sql executou
-- REVOKE ALL ... FROM authenticated sem reconceder. Resultado: a policy
-- owner_select_campaigns existia, mas a leitura do proprietário falhava via
-- PostgREST com "permission denied for table campaigns".
--
-- Correção forward-only e idempotente; não edita migrations históricas.

GRANT SELECT ON TABLE public.campaigns TO authenticated;

-- REVERT:
-- REVOKE SELECT ON TABLE public.campaigns FROM authenticated;
