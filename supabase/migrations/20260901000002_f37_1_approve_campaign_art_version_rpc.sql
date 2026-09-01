-- Migration F37.1: RPC approve_campaign_art_version (transacional)
-- Approval Gate + Candidata Única (D5/D8) — aprovação atômica da candidata:
--  1. SELECT ... FOR UPDATE da versão (guarded update — anti-concorrência com o
--     índice único parcial 1-approved da migration 20260901000001);
--  2. Defensivo: nenhuma outra linha da campanha retém asset ativo;
--  3. Marca a candidata 'approved';
--  4. Reponta campaigns (storage_path → aprovada, approved_version_id, approved_at,
--     approval_status='approved') na MESMA transação.
-- Se qualquer passo falhar, nada é aplicado (ROLLBACK automático do bloco).
-- Telemetria (D8): sem novo generation_type — funil via campaign_art_versions.status
-- + campaigns.approved_at; custo por campanha aprovada já aparece no painel F38.2 via
-- operation_run_id (sem mudança).
--
-- Segurança:
--   * SECURITY DEFINER + SET search_path = '' + identificadores schema-qualified
--     (padrão F43 admin_update_feature_flag).
--   * REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role.

-- =============================================================================
-- 1. Função approve_campaign_art_version
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_campaign_art_version(
  p_campaign_id uuid,
  p_version_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_asset_status text;
  v_campaign_id uuid;
  v_storage_path text;
BEGIN
  -- Validação de inputs (nunca deriva de input não validado)
  IF p_campaign_id IS NULL OR p_version_id IS NULL THEN
    RAISE EXCEPTION 'missing_params';
  END IF;

  -- 1. Guarded update: trava a versão antes de validar/aprovar
  SELECT status, asset_status, campaign_id, storage_path
    INTO v_status, v_asset_status, v_campaign_id, v_storage_path
    FROM public.campaign_art_versions
   WHERE id = p_version_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'version_not_found';
  END IF;

  -- Validações sequenciais com código de erro por tipo (mapeados na rota approve)
  IF v_campaign_id <> p_campaign_id THEN
    RAISE EXCEPTION 'version_campaign_mismatch';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'version_not_pending';
  END IF;

  IF v_asset_status <> 'active' THEN
    RAISE EXCEPTION 'version_not_active';
  END IF;

  -- 2. Defensivo (D8): nenhuma outra linha da campanha retém asset ativo
  --    (no-op na 37.1 — só existe v1; remoção física de arquivo é do fluxo de
  --    substituição, 37.2)
  UPDATE public.campaign_art_versions
     SET asset_status = 'discarded',
         storage_path = NULL,
         asset_deleted_at = now()
   WHERE campaign_id = p_campaign_id
     AND id <> p_version_id
     AND asset_status = 'active';

  -- 3. Marca a candidata como aprovada
  UPDATE public.campaign_art_versions
     SET status = 'approved'
   WHERE id = p_version_id;

  -- 4. Reponta campaigns na mesma transação (decisão 3)
  UPDATE public.campaigns
     SET storage_path = v_storage_path,
         approved_version_id = p_version_id,
         approved_at = now(),
         approval_status = 'approved'
   WHERE id = p_campaign_id;

  RETURN jsonb_build_object('success', true, 'campaign_id', p_campaign_id, 'version_id', p_version_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_campaign_art_version(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_campaign_art_version(uuid, uuid)
  TO service_role;

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.approve_campaign_art_version(uuid, uuid) FROM service_role;
-- DROP FUNCTION IF EXISTS public.approve_campaign_art_version(uuid, uuid);
