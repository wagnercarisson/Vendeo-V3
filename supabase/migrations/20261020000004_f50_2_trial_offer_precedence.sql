-- =============================================================================
-- F50.2 — Oferta de teste gratuito de 28 dias
-- Migration 04/04: precedência com demo legada e bônus mensal.
--
-- Regras:
--   - Conta criada em/a partir de launch_at não recebe demo legada, mesmo com
--     a chave desligada.
--   - Raiz com enrollment não recebe demo legada nem mensal automático.
--   - Contas antigas e configuração/chave mensal permanecem inalteradas.
-- =============================================================================

-- =============================================================================
-- 1. grant_demo_credits — coorte por launch_at, não por enabled
-- =============================================================================
CREATE OR REPLACE FUNCTION public.grant_demo_credits(
  p_store_id UUID,
  p_root_hash TEXT,
  p_amount INTEGER,
  p_demo_grant_enabled BOOLEAN,
  p_ttl_hours INTEGER DEFAULT 168,
  p_idempotency_key TEXT DEFAULT NULL,
  p_granted_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grant_tx_id UUID;
  v_entitlement_id UUID;
  v_demo_expires_at TIMESTAMPTZ;
  v_user_id UUID;
  v_launch_at TIMESTAMPTZ;
  v_account_created_at TIMESTAMPTZ;
BEGIN
  IF p_demo_grant_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'disabled');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'amount_invalido');
  END IF;

  -- Coorte da oferta de 28 dias: decisão por launch_at, nunca por enabled.
  SELECT launch_at INTO v_launch_at
  FROM public.trial_offer_settings
  WHERE offer_key = 'trial_28d_v1';

  IF v_launch_at IS NOT NULL THEN
    SELECT au.created_at INTO v_account_created_at
    FROM public.stores s
    JOIN auth.users au ON au.id = s.user_id
    WHERE s.id = p_store_id;

    IF v_account_created_at IS NOT NULL AND v_account_created_at >= v_launch_at THEN
      RETURN jsonb_build_object('granted', false, 'reason', 'trial_offer_applies');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trial_offer_enrollments e
    WHERE e.root_hash = p_root_hash
  ) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'trial_offer_consumed');
  END IF;

  -- Elegibilidade ANTES de qualquer INSERT (evita entitlement demo órfão)
  IF EXISTS (SELECT 1 FROM public.freemium_entitlements
             WHERE root_hash = p_root_hash AND benefit_type = 'onboarding') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'onboarding_consumed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.freemium_entitlements
             WHERE root_hash = p_root_hash AND benefit_type = 'admin_exception') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'admin_exception_consumed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.freemium_entitlements
             WHERE store_id = p_store_id AND benefit_type = 'admin_exception') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'admin_exception_consumed');
  END IF;

  v_entitlement_id := public.try_grant_demo_entitlement(p_store_id, p_root_hash);

  IF v_entitlement_id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_granted');
  END IF;

  v_demo_expires_at := now() + make_interval(hours => p_ttl_hours);

  SELECT user_id INTO v_user_id FROM public.stores WHERE id = p_store_id;

  v_grant_tx_id := public.grant_credits(
    p_store_id,
    p_amount,
    'demo',
    p_idempotency_key,
    jsonb_build_object(
      'source', 'demo_grant',
      'ttl_hours', p_ttl_hours,
      'cohort', 'legacy'
    ),
    'demo',
    v_demo_expires_at
  );

  UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
  WHERE id = v_entitlement_id;

  IF p_granted_by IS NOT NULL THEN
    INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
    VALUES ('credit_grant', 'store', p_store_id, p_granted_by, 'Concessão de demonstração gratuita',
      jsonb_build_object('grant_type', 'demo', 'grant_transaction_id', v_grant_tx_id, 'entitlement_id', v_entitlement_id));
  END IF;

  BEGIN
    INSERT INTO public.product_events (store_id, user_id, event_type, dedup_key, properties)
    VALUES (p_store_id, v_user_id, 'demo_granted', v_grant_tx_id::text,
      jsonb_build_object('grant_tx_id', v_grant_tx_id, 'amount', p_amount))
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'demo_granted best-effort (product_events): %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.credit_notifications (store_id, user_id, kind, dedup_key, payload)
    VALUES (p_store_id, v_user_id, 'demo_granted', v_grant_tx_id::text,
      jsonb_build_object('grant_tx_id', v_grant_tx_id, 'amount', p_amount))
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'demo_granted best-effort (credit_notifications): %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'granted', true,
    'grant_transaction_id', v_grant_tx_id,
    'demo_expires_at', v_demo_expires_at,
    'entitlement_id', v_entitlement_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_demo_credits(UUID, TEXT, INTEGER, BOOLEAN, INTEGER, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_demo_credits(UUID, TEXT, INTEGER, BOOLEAN, INTEGER, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- 2. grant_monthly_credits — exclusão permanente por enrollment
-- =============================================================================
CREATE OR REPLACE FUNCTION public.grant_monthly_credits(
  p_amount INTEGER,
  p_bonus_cap INTEGER,
  p_min_store_age_days INTEGER,
  p_reference_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ref_date DATE;
  v_cycle TEXT;
  v_root_hash TEXT;
  v_recipient RECORD;
  v_recipient_bonus INTEGER;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
  v_anniv_day INTEGER;
  v_last_day INTEGER;
  v_grant_day INTEGER;
  v_roots_considered INTEGER := 0;
  v_eligible INTEGER := 0;
  v_granted INTEGER := 0;
  v_skipped_no_cnpj INTEGER := 0;
  v_skipped_already_granted INTEGER := 0;
  v_skipped_not_due INTEGER := 0;
  v_skipped_bonus_threshold INTEGER := 0;
  v_skipped_trial_offer_cohort INTEGER := 0;
BEGIN
  v_ref_date := COALESCE(p_reference_date, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_cycle := TO_CHAR(v_ref_date, 'YYYY-MM');

  SELECT COUNT(*) INTO v_skipped_no_cnpj
  FROM public.stores s
  WHERE s.is_test_store = FALSE
    AND (s.cnpj_root_hash IS NULL OR s.cnpj_root_hash = '');

  FOR v_root_hash IN
    SELECT DISTINCT s.cnpj_root_hash
    FROM public.stores s
    WHERE s.cnpj_root_hash IS NOT NULL
      AND s.cnpj_root_hash != ''
      AND s.is_test_store = FALSE
  LOOP
    v_roots_considered := v_roots_considered + 1;

    -- Coorte do teste de 28 dias: exclusão permanente, sem retorno automático.
    IF EXISTS (
      SELECT 1 FROM public.trial_offer_enrollments e
      WHERE e.root_hash = v_root_hash
    ) THEN
      v_skipped_trial_offer_cohort := v_skipped_trial_offer_cohort + 1;
      CONTINUE;
    END IF;

    SELECT s.id, s.created_at
    INTO v_recipient
    FROM public.stores s
    WHERE s.cnpj_root_hash = v_root_hash
      AND s.is_test_store = FALSE
    ORDER BY CASE WHEN substring(s.cnpj_normalized, 9, 4) = '0001' THEN 0 ELSE 1 END,
             s.created_at ASC, s.id ASC
    LIMIT 1;

    IF v_recipient.id IS NULL THEN
      v_skipped_not_due := v_skipped_not_due + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.freemium_entitlements fe
      WHERE fe.root_hash = v_root_hash AND fe.benefit_type = 'onboarding'
    ) AND NOT EXISTS (
      SELECT 1 FROM public.credit_transactions ct
      JOIN public.stores s ON s.id = ct.store_id
      WHERE s.cnpj_root_hash = v_root_hash
        AND ct.type IN ('bonus_onboarding', 'bonus_monthly')
    ) THEN
      v_skipped_not_due := v_skipped_not_due + 1;
      CONTINUE;
    END IF;

    IF (v_recipient.created_at AT TIME ZONE 'America/Sao_Paulo')::date > (v_ref_date - p_min_store_age_days) THEN
      v_skipped_not_due := v_skipped_not_due + 1;
      CONTINUE;
    END IF;

    v_anniv_day := EXTRACT(DAY FROM (v_recipient.created_at AT TIME ZONE 'America/Sao_Paulo'));
    v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_ref_date) + INTERVAL '1 month - 1 day'));
    v_grant_day := LEAST(v_anniv_day, v_last_day);

    IF EXTRACT(DAY FROM v_ref_date) <> v_grant_day THEN
      v_skipped_not_due := v_skipped_not_due + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance)
    VALUES (v_recipient.id, 0, 0, 0)
    ON CONFLICT (store_id) DO NOTHING;

    SELECT cb.bonus_balance INTO v_recipient_bonus
    FROM public.credit_balances cb
    WHERE cb.store_id = v_recipient.id
    FOR UPDATE;

    IF EXISTS (
      SELECT 1 FROM public.freemium_entitlements
      WHERE root_hash = v_root_hash
        AND benefit_type = 'monthly'
        AND COALESCE(cycle, '_nostring_') = v_cycle
    ) THEN
      v_skipped_already_granted := v_skipped_already_granted + 1;
      CONTINUE;
    END IF;

    IF v_recipient_bonus >= p_bonus_cap THEN
      v_skipped_bonus_threshold := v_skipped_bonus_threshold + 1;
      CONTINUE;
    END IF;

    v_entitlement_id := public.try_grant_monthly_entitlement(v_recipient.id, v_root_hash, v_cycle);

    IF v_entitlement_id IS NULL THEN
      v_skipped_already_granted := v_skipped_already_granted + 1;
      CONTINUE;
    END IF;

    v_grant_tx_id := public.grant_credits(
      v_recipient.id, p_amount, 'credito_mensal',
      'mensal_' || v_cycle || '_' || v_root_hash,
      jsonb_build_object('cycle', v_cycle, 'source', 'monthly_cron'),
      'bonus_monthly'
    );

    UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
    WHERE id = v_entitlement_id;

    v_granted := v_granted + 1;
  END LOOP;

  v_eligible := v_granted + v_skipped_already_granted + v_skipped_bonus_threshold;

  RETURN jsonb_build_object(
    'eligible', v_eligible,
    'granted', v_granted,
    'skipped', v_eligible - v_granted,
    'errors', 0,
    'details', jsonb_build_object(
      'roots_considered', v_roots_considered,
      'skipped_no_cnpj', v_skipped_no_cnpj,
      'skipped_already_granted', v_skipped_already_granted,
      'skipped_not_due', v_skipped_not_due,
      'skipped_bonus_threshold', v_skipped_bonus_threshold,
      'skipped_trial_offer_cohort', v_skipped_trial_offer_cohort
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_monthly_credits(INTEGER, INTEGER, INTEGER, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits(INTEGER, INTEGER, INTEGER, DATE)
  TO service_role;

-- =============================================================================
-- REVERT (comentado)
-- =============================================================================
-- Recriar grant_demo_credits e grant_monthly_credits a partir das migrations
-- 20260920000001_f50_demo_credits.sql e 20260815000001_grant_monthly_credits_por_raiz.sql.
