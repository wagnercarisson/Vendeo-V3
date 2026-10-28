-- =============================================================================
-- F57.2 — reconciliação PONTUAL da ACL de uma função administrativa
-- =============================================================================
-- NÃO é migration. NÃO altera ledger. NÃO recria a função.
-- Alvo: homolog 127.0.0.1:57782/postgres.
--
-- Execute somente após revisão/autorização explícita e com o preflight do
-- runbook 57.2-05-ADMIN-ACL-RECONCILIATION.md.
-- Use psql SEM --single-transaction: o arquivo controla BEGIN/COMMIT uma única vez.
-- =============================================================================

\set ON_ERROR_STOP on
\pset pager off

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE f572_admin_acl_before ON COMMIT DROP AS
SELECT
  p.oid AS function_oid,
  p.oid::regprocedure AS signature,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  p.proacl AS acl_before,
  md5(p.prosrc) AS body_md5_before,
  pg_get_functiondef(p.oid) AS definition_before
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'admin_create_store_for_user'
  AND oidvectortypes(p.proargtypes) = 'uuid, uuid, text, text';

-- Estado anterior: assinatura, proprietário, ACL, hash do corpo e definição.
SELECT * FROM f572_admin_acl_before;

DO $guard$
DECLARE
  v_oid oid;
  v_count integer;
  v_owner text;
  v_secdef boolean;
  v_body text;
BEGIN
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'alvo recusado: banco atual é %, esperado postgres', current_database();
  END IF;

  SELECT count(*), min(p.oid)
    INTO v_count, v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_create_store_for_user'
    AND oidvectortypes(p.proargtypes) = 'uuid, uuid, text, text';

  IF v_count <> 1 OR v_oid IS NULL THEN
    RAISE EXCEPTION 'assinatura exata admin_create_store_for_user(uuid,uuid,text,text) não encontrada ou ambígua (count=%)', v_count;
  END IF;

  SELECT pg_get_userbyid(p.proowner), p.prosecdef, p.prosrc
    INTO v_owner, v_secdef, v_body
  FROM pg_proc p
  WHERE p.oid = v_oid;

  IF NOT v_secdef THEN
    RAISE EXCEPTION 'função não é SECURITY DEFINER; pare e revise';
  END IF;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'proprietário da função não resolvido; pare';
  END IF;
  IF position('usuario_ja_possui_loja' in v_body) = 0
     OR position('create_store_with_initial_grant' in v_body) = 0 THEN
    RAISE EXCEPTION 'corpo não contém os marcadores esperados; pare e compare com a versão vigente';
  END IF;
END
$guard$;

-- Reconciliação mínima: remove apenas EXECUTE de PUBLIC/anon/authenticated
-- nesta assinatura; preserva owner, corpo, assinatura e demais grants.
REVOKE EXECUTE ON FUNCTION public.admin_create_store_for_user(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_store_for_user(uuid, uuid, text, text)
  TO service_role;

DO $verify$
DECLARE
  v_oid oid;
  v_owner text;
  v_body_md5 text;
  v_public boolean;
BEGIN
  SELECT p.oid::oid, pg_get_userbyid(p.proowner), md5(p.prosrc)
    INTO v_oid, v_owner, v_body_md5
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_create_store_for_user'
    AND oidvectortypes(p.proargtypes) = 'uuid, uuid, text, text';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'função desapareceu durante a reconciliação; rollback';
  END IF;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'owner nulo após reconciliação; rollback';
  END IF;
  IF v_body_md5 IS NULL THEN
    RAISE EXCEPTION 'corpo nulo após reconciliação; rollback';
  END IF;
  IF v_owner IS DISTINCT FROM (SELECT owner FROM f572_admin_acl_before) THEN
    RAISE EXCEPTION 'owner mudou durante a reconciliação; rollback';
  END IF;
  IF v_body_md5 IS DISTINCT FROM (SELECT body_md5_before FROM f572_admin_acl_before) THEN
    RAISE EXCEPTION 'corpo mudou durante a reconciliação; rollback';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon ainda possui EXECUTE; rollback';
  END IF;
  IF has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated ainda possui EXECUTE; rollback';
  END IF;
  IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role sem EXECUTE; rollback';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = v_oid AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
  ) INTO v_public;
  IF v_public THEN
    RAISE EXCEPTION 'PUBLIC ainda possui EXECUTE; rollback';
  END IF;
END
$verify$;

-- Estado posterior, para registro na evidência.
SELECT
  p.oid::regprocedure AS signature,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  p.proacl AS acl_after,
  md5(p.prosrc) AS body_md5_after,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'admin_create_store_for_user'
  AND oidvectortypes(p.proargtypes) = 'uuid, uuid, text, text';

COMMIT;

-- =============================================================================
-- REVERSÃO MANUAL (somente com autorização explícita; NÃO reaplicar em bloco)
-- =============================================================================
-- A ACL anterior capturada no campo acl_before deve ser usada. No estado
-- observado no homolog ela incluía anon e authenticated:
--
-- BEGIN;
-- GRANT EXECUTE ON FUNCTION public.admin_create_store_for_user(uuid, uuid, text, text)
--   TO anon, authenticated;
-- COMMIT;
--
-- Não conceder a PUBLIC se acl_before não continha PUBLIC. Não alterar owner,
-- corpo ou assinatura na reversão.
