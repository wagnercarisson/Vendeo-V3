-- Fix audit log constraints and missing fields in F33 admin RPCs
-- Duas correções:
--   1. action CHECK constraint não incluía os novos valores
--   2. RPCs e rotas não inseriam reason (NOT NULL)

-- =============================================================================
-- 1. Atualizar CHECK constraint da coluna action
-- =============================================================================
ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action IN (
    'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
    'approve_verification', 'reject_verification', 'create_test_store',
    'admin_exception', 'reveal_cnpj'
  ));

-- =============================================================================
-- 2. Fix RPC admin_approve_store_verification — adicionar reason
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_approve_store_verification(
  p_store_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_root_hash TEXT;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
  v_store_data JSONB;
BEGIN
  SELECT cnpj_root_hash INTO v_root_hash
  FROM public.stores WHERE id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  UPDATE public.stores SET
    verification_status = 'approved',
    verification_decided_at = now()
  WHERE id = p_store_id;

  IF v_root_hash IS NOT NULL AND v_root_hash != '' THEN
    v_entitlement_id := public.try_grant_onboarding_entitlement(p_store_id, v_root_hash);

    IF v_entitlement_id IS NOT NULL THEN
      SELECT public.grant_credits(
        p_store_id, 10, 'onboarding',
        'onboarding_' || p_store_id,
        jsonb_build_object('source', 'admin_approve_verification'),
        'bonus_onboarding'
      ) INTO v_grant_tx_id;

      UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
      WHERE id = v_entitlement_id;
    END IF;
  END IF;

  INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
  VALUES ('approve_verification', 'store', p_store_id, p_admin_id,
    'Aprovado manualmente por admin',
    jsonb_build_object(
      'entitlement_id', v_entitlement_id,
      'grant_transaction_id', v_grant_tx_id
    ));

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT id, verification_status, verification_decided_at FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object(
    'success', true,
    'onboardingGranted', v_entitlement_id IS NOT NULL,
    'store', v_store_data
  );
END;
$$;

-- =============================================================================
-- 3. Fix RPC admin_reject_store_verification — adicionar reason e metadata
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_reject_store_verification(
  p_store_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_data JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  UPDATE public.stores SET
    verification_status = 'rejected',
    verification_decided_at = now()
  WHERE id = p_store_id;

  INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
  VALUES ('reject_verification', 'store', p_store_id, p_admin_id,
    'Rejeitado manualmente por admin',
    '{}'::jsonb);

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT id, verification_status, verification_decided_at FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object('success', true, 'store', v_store_data);
END;
$$;

-- =============================================================================
-- REVERT
-- =============================================================================
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check
--   CHECK (action IN ('credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund'));
