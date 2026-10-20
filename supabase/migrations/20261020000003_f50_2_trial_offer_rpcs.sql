-- =============================================================================
-- F50.2 — Oferta de teste gratuito de 28 dias
-- Migration 03/04: conclusão, inscrição, parcelas, processamento e relógio.
--
-- Princípios:
--   - p_now é um parâmetro de teste/backend privilegiado; em produção o default
--     é now() do servidor e as rotas públicas não o enviam.
--   - As variantes _at preservam o comportamento dos wrappers legados.
--   - Nenhuma concessão usa grant_credits(demo): a parcela estende o episódio.
-- =============================================================================

-- =============================================================================
-- 1. Elegibilidade compartilhada
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trial_offer_eligibility(
  p_store_id UUID,
  p_now TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store RECORD;
  v_settings RECORD;
  v_account_created_at TIMESTAMPTZ;
  v_existing UUID;
BEGIN
  SELECT s.id, s.user_id, s.cnpj_root_hash AS root_hash, s.is_test_store, s.onboarding_completed_at
  INTO v_store
  FROM public.stores s
  WHERE s.id = p_store_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'store_not_found');
  END IF;

  IF v_store.onboarding_completed_at IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_completed');
  END IF;

  IF p_now >= v_store.onboarding_completed_at + interval '28 days' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'expired_window',
      'onboarding_completed_at', v_store.onboarding_completed_at
    );
  END IF;

  SELECT enabled, launch_at INTO v_settings
  FROM public.trial_offer_settings
  WHERE offer_key = 'trial_28d_v1';

  IF NOT FOUND OR v_settings.enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'offer_disabled');
  END IF;

  IF v_settings.launch_at IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'launch_not_set');
  END IF;

  SELECT au.created_at INTO v_account_created_at
  FROM auth.users au
  WHERE au.id = v_store.user_id;

  IF v_account_created_at IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'account_not_found');
  END IF;

  IF v_account_created_at < v_settings.launch_at THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'account_before_launch');
  END IF;

  IF v_store.root_hash IS NULL OR btrim(v_store.root_hash) = '' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_root');
  END IF;

  IF v_store.is_test_store IS TRUE THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'test_store');
  END IF;

  SELECT e.id INTO v_existing
  FROM public.trial_offer_enrollments e
  WHERE e.root_hash = v_store.root_hash OR e.store_id = v_store.id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'existing_enrollment_id', v_existing,
      'store_id', v_store.id,
      'user_id', v_store.user_id,
      'root_hash', v_store.root_hash,
      'onboarding_completed_at', v_store.onboarding_completed_at
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.freemium_entitlements fe
    WHERE fe.root_hash = v_store.root_hash
      AND fe.benefit_type IN ('onboarding', 'demo', 'admin_exception')
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'prior_benefit');
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'existing_enrollment_id', NULL,
    'store_id', v_store.id,
    'user_id', v_store.user_id,
    'root_hash', v_store.root_hash,
    'onboarding_completed_at', v_store.onboarding_completed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trial_offer_eligibility(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_eligibility(UUID, TIMESTAMPTZ)
  TO service_role;

-- =============================================================================
-- 2. Conclusão do onboarding (não cria enrollment)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_onboarding_completion(
  p_store_id UUID,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_completed_at TIMESTAMPTZ;
  v_ready BOOLEAN;
  v_eligibility JSONB;
BEGIN
  SELECT s.onboarding_completed_at INTO v_completed_at
  FROM public.stores s
  WHERE s.id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('completed', false, 'status', 'store_not_found', 'reason', 'store_not_found');
  END IF;

  IF v_completed_at IS NULL THEN
    SELECT (public.check_store_readiness(p_store_id) ->> 'ready')::boolean INTO v_ready;
    IF v_ready IS NOT TRUE THEN
      RETURN jsonb_build_object('completed', false, 'status', 'not_ready', 'reason', 'not_ready');
    END IF;

    UPDATE public.stores
    SET onboarding_completed_at = p_now
    WHERE id = p_store_id AND onboarding_completed_at IS NULL;

    v_completed_at := p_now;
  END IF;

  v_eligibility := public.trial_offer_eligibility(p_store_id, p_now);

  RETURN jsonb_build_object(
    'completed', true,
    'status', 'completed',
    'onboarding_completed_at', v_completed_at,
    'eligibility', v_eligibility
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_onboarding_completion(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_onboarding_completion(UUID, TIMESTAMPTZ)
  TO service_role;

-- =============================================================================
-- 3. Inscrição + parcela 0
-- =============================================================================
CREATE OR REPLACE FUNCTION public.start_trial_offer_enrollment(
  p_store_id UUID,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store RECORD;
  v_eligibility JSONB;
  v_enrollment_id UUID;
  v_started_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_granted_total INTEGER;
  v_last_granted_seq INTEGER;
  v_grant JSONB;
BEGIN
  SELECT s.id, s.user_id, s.cnpj_root_hash AS root_hash, s.onboarding_completed_at
  INTO v_store
  FROM public.stores s
  WHERE s.id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_eligible', 'reason', 'store_not_found');
  END IF;

  IF v_store.onboarding_completed_at IS NULL THEN
    RETURN jsonb_build_object('status', 'not_ready', 'reason', 'not_completed');
  END IF;

  v_eligibility := public.trial_offer_eligibility(p_store_id, p_now);

  IF (v_eligibility ->> 'eligible')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'status', v_eligibility ->> 'reason',
      'reason', v_eligibility ->> 'reason',
      'eligibility', v_eligibility
    );
  END IF;

  IF v_eligibility ->> 'existing_enrollment_id' IS NOT NULL THEN
    SELECT e.id, e.started_at, e.expires_at, e.granted_total, e.last_granted_seq
    INTO v_enrollment_id, v_started_at, v_expires_at, v_granted_total, v_last_granted_seq
    FROM public.trial_offer_enrollments e
    WHERE e.id = (v_eligibility ->> 'existing_enrollment_id')::uuid;

    RETURN jsonb_build_object(
      'status', 'existing',
      'enrollment_id', v_enrollment_id,
      'started_at', v_started_at,
      'expires_at', v_expires_at,
      'granted_total', v_granted_total,
      'last_granted_seq', v_last_granted_seq
    );
  END IF;

  v_started_at := v_store.onboarding_completed_at;
  v_expires_at := v_started_at + interval '28 days';

  INSERT INTO public.trial_offer_enrollments (
    store_id, user_id, root_hash, offer_key, started_at, expires_at
  ) VALUES (
    v_store.id, v_store.user_id, v_store.root_hash, 'trial_28d_v1', v_started_at, v_expires_at
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_enrollment_id;

  IF v_enrollment_id IS NULL THEN
    SELECT e.id, e.started_at, e.expires_at, e.granted_total, e.last_granted_seq
    INTO v_enrollment_id, v_started_at, v_expires_at, v_granted_total, v_last_granted_seq
    FROM public.trial_offer_enrollments e
    WHERE e.root_hash = v_store.root_hash OR e.store_id = v_store.id
    LIMIT 1;

    RETURN jsonb_build_object(
      'status', 'existing',
      'enrollment_id', v_enrollment_id,
      'started_at', v_started_at,
      'expires_at', v_expires_at,
      'granted_total', v_granted_total,
      'last_granted_seq', v_last_granted_seq
    );
  END IF;

  v_grant := public.grant_trial_offer_installment(v_enrollment_id, 0, p_now);

  IF (v_grant ->> 'granted')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'trial_offer_day0_failed';
  END IF;

  RETURN jsonb_build_object(
    'status', 'started',
    'enrollment_id', v_enrollment_id,
    'started_at', v_started_at,
    'expires_at', v_expires_at,
    'grant', v_grant
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_trial_offer_enrollment(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_trial_offer_enrollment(UUID, TIMESTAMPTZ)
  TO service_role;

-- =============================================================================
-- 4. Concessão de parcela (lock enrollment -> lock credit_balances)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.grant_trial_offer_installment(
  p_enrollment_id UUID,
  p_seq INTEGER,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enrollment RECORD;
  v_balance RECORD;
  v_due_at TIMESTAMPTZ;
  v_idempotency_key TEXT;
  v_existing_tx UUID;
  v_tx_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
BEGIN
  SELECT e.id, e.store_id, e.started_at, e.expires_at, e.granted_total, e.last_granted_seq
  INTO v_enrollment
  FROM public.trial_offer_enrollments e
  WHERE e.id = p_enrollment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'enrollment_not_found');
  END IF;

  IF p_seq IS NULL OR p_seq < 0 OR p_seq > 3 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'invalid_seq');
  END IF;

  v_due_at := v_enrollment.started_at + make_interval(days => p_seq * 7);
  v_idempotency_key := 'trial28d:' || p_enrollment_id::text || ':' || p_seq::text;

  IF p_now >= v_enrollment.expires_at THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'expired');
  END IF;

  IF p_now < v_due_at THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'not_due', 'due_at', v_due_at);
  END IF;

  IF p_seq <= v_enrollment.last_granted_seq THEN
    SELECT ct.id INTO v_existing_tx
    FROM public.credit_transactions ct
    WHERE ct.store_id = v_enrollment.store_id
      AND ct.idempotency_key = v_idempotency_key;

    RETURN jsonb_build_object(
      'granted', true,
      'idempotent', true,
      'grant_tx_id', v_existing_tx,
      'seq', p_seq,
      'granted_total', v_enrollment.granted_total
    );
  END IF;

  IF p_seq <> v_enrollment.last_granted_seq + 1 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'out_of_order');
  END IF;

  IF v_enrollment.granted_total + 5 > 20 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'limit');
  END IF;

  INSERT INTO public.credit_balances (store_id, balance)
  VALUES (v_enrollment.store_id, 0)
  ON CONFLICT (store_id) DO NOTHING;

  SELECT balance, demo_balance, bonus_balance, purchased_balance,
         demo_expires_at, demo_cycle_id, origin_demo_grant_tx_id, demo_contributing_tx_ids
  INTO v_balance
  FROM public.credit_balances
  WHERE store_id = v_enrollment.store_id
  FOR UPDATE;

  v_balance_before := v_balance.balance;
  v_balance_after := v_balance_before + 5;

  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    reason, idempotency_key, metadata
  ) VALUES (
    v_enrollment.store_id,
    'demo',
    5,
    v_balance_before,
    v_balance_after,
    'teste gratuito de 28 dias',
    v_idempotency_key,
    jsonb_build_object(
      'credit_program', 'trial_28d',
      'offer_key', 'trial_28d_v1',
      'enrollment_id', p_enrollment_id,
      'installment_seq', p_seq,
      'due_at', v_due_at,
      'expires_at', v_enrollment.expires_at
    )
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.credit_balances
  SET demo_balance = demo_balance + 5,
      demo_expires_at = v_enrollment.expires_at,
      demo_cycle_id = COALESCE(demo_cycle_id, v_tx_id),
      origin_demo_grant_tx_id = COALESCE(origin_demo_grant_tx_id, v_tx_id),
      demo_contributing_tx_ids = array_append(
        COALESCE(demo_contributing_tx_ids, '{}'::uuid[]),
        v_tx_id
      )
  WHERE store_id = v_enrollment.store_id;

  UPDATE public.trial_offer_enrollments
  SET granted_total = granted_total + 5,
      last_granted_seq = p_seq
  WHERE id = p_enrollment_id;

  RETURN jsonb_build_object(
    'granted', true,
    'idempotent', false,
    'grant_tx_id', v_tx_id,
    'seq', p_seq,
    'granted_total', v_enrollment.granted_total + 5,
    'expires_at', v_enrollment.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_trial_offer_installment(UUID, INTEGER, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_trial_offer_installment(UUID, INTEGER, TIMESTAMPTZ)
  TO service_role;

-- =============================================================================
-- 5. Processamento em lote (cron existente)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_trial_offer_installments(
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enrollment RECORD;
  v_next INTEGER;
  v_grant JSONB;
  v_granted INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  FOR v_enrollment IN
    SELECT e.id, e.last_granted_seq
    FROM public.trial_offer_enrollments e
    WHERE e.expires_at > p_now
      AND e.last_granted_seq < 3
    ORDER BY e.created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      v_next := v_enrollment.last_granted_seq + 1;

      WHILE v_next <= 3 LOOP
        v_grant := public.grant_trial_offer_installment(v_enrollment.id, v_next, p_now);

        IF (v_grant ->> 'granted')::boolean IS TRUE THEN
          v_granted := v_granted + 1;
        ELSIF v_grant ->> 'reason' = 'not_due' THEN
          EXIT;
        ELSE
          v_skipped := v_skipped + 1;
          EXIT;
        END IF;

        v_next := v_next + 1;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('granted', v_granted, 'skipped', v_skipped, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION public.process_trial_offer_installments(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_trial_offer_installments(TIMESTAMPTZ)
  TO service_role;

-- =============================================================================
-- 6. Variante _at da expiração (wrapper legado preservado)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.materialize_demo_expiration_at(
  p_store_id UUID,
  p_now TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_demo_balance INTEGER;
  v_demo_expires_at TIMESTAMPTZ;
  v_demo_cycle_id UUID;
  v_origin UUID;
  v_contributing UUID[];
  v_bonus INTEGER;
  v_purchased INTEGER;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_tx_id UUID;
BEGIN
  SELECT demo_balance, demo_expires_at, demo_cycle_id, origin_demo_grant_tx_id,
         demo_contributing_tx_ids, bonus_balance, purchased_balance, balance
  INTO v_demo_balance, v_demo_expires_at, v_demo_cycle_id, v_origin,
       v_contributing, v_bonus, v_purchased, v_balance_before
  FROM public.credit_balances
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF v_demo_balance IS NULL THEN
    RETURN jsonb_build_object('expired', false, 'reason', 'no_balance_row', 'available', 0);
  END IF;

  IF v_demo_balance = 0 THEN
    RETURN jsonb_build_object('expired', false, 'reason', 'no_demo_balance', 'available', v_bonus + v_purchased);
  END IF;

  IF v_demo_expires_at IS NULL OR v_demo_expires_at > p_now THEN
    RETURN jsonb_build_object('expired', false, 'reason', 'not_expired', 'available', v_demo_balance + v_bonus + v_purchased);
  END IF;

  v_balance_after := v_balance_before - v_demo_balance;

  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    reason, reference, metadata
  ) VALUES (
    p_store_id, 'expiration', -v_demo_balance, v_balance_before, v_balance_after,
    'expiração da demonstração',
    v_demo_cycle_id::text,
    jsonb_build_object(
      'bucket', 'demo',
      'expired_amount', v_demo_balance,
      'cycle_id', v_demo_cycle_id,
      'origin_demo_grant_tx_id', v_origin,
      'contributing_tx_ids', to_jsonb(v_contributing::text[])
    )
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.credit_balances
  SET demo_balance = 0,
      demo_expires_at = NULL,
      demo_cycle_id = NULL,
      demo_contributing_tx_ids = '{}'::uuid[]
  WHERE store_id = p_store_id;

  RETURN jsonb_build_object('expired', true, 'expiration_tx_id', v_tx_id, 'available', v_bonus + v_purchased);
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_demo_expiration_at(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_demo_expiration_at(UUID, TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION public.materialize_demo_expiration(p_store_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.materialize_demo_expiration_at(p_store_id, now());
$$;

REVOKE ALL ON FUNCTION public.materialize_demo_expiration(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_demo_expiration(UUID)
  TO service_role;

-- =============================================================================
-- 7. Variante _at do estorno (wrapper legado preservado)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.refund_credit_at(
  p_tx_id UUID,
  p_reason TEXT,
  p_idempotency_key TEXT,
  p_metadata JSONB,
  p_now TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  store_id_var UUID;
  original_amount INTEGER;
  original_type TEXT;
  original_metadata JSONB;
  current_bonus INTEGER;
  current_purchased INTEGER;
  current_demo INTEGER;
  current_balance INTEGER;
  cur_demo_expires TIMESTAMPTZ;
  cur_demo_cycle UUID;
  cur_demo_origin UUID;
  cur_demo_contrib UUID[];
  refund_amount INTEGER;
  balance_before INTEGER;
  balance_after INTEGER;
  tx_id UUID;
  existing_tx_id UUID;
  duplicate_refund_id UUID;
  bonus_restore INTEGER;
  purchased_restore INTEGER;
  demo_restore INTEGER;
  v_origin UUID;
  v_new_demo_expires TIMESTAMPTZ;
  v_new_demo_cycle UUID;
  v_new_demo_contrib UUID[];
BEGIN
  SELECT store_id, amount, type, metadata
  INTO store_id_var, original_amount, original_type, original_metadata
  FROM public.credit_transactions
  WHERE id = p_tx_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transacao_nao_encontrada';
  END IF;

  IF original_type != 'deduction' THEN
    RAISE EXCEPTION 'tipo_invalido';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_tx_id
    FROM public.credit_transactions
    WHERE store_id = store_id_var AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF (SELECT type FROM public.credit_transactions WHERE id = existing_tx_id) = 'refund' THEN
        RETURN existing_tx_id;
      ELSE
        RAISE EXCEPTION 'idempotency_conflict';
      END IF;
    END IF;
  END IF;

  SELECT id INTO duplicate_refund_id
  FROM public.credit_transactions
  WHERE reference = p_tx_id::text AND type = 'refund';

  IF FOUND THEN
    RETURN duplicate_refund_id;
  END IF;

  demo_restore := COALESCE((original_metadata->>'demo_amount')::INTEGER, 0);
  bonus_restore := COALESCE((original_metadata->>'bonus_amount')::INTEGER, 0);
  purchased_restore := COALESCE((original_metadata->>'purchased_amount')::INTEGER, 0);

  IF (original_metadata->>'demo_amount') IS NULL
     AND (original_metadata->>'bonus_amount') IS NULL
     AND (original_metadata->>'purchased_amount') IS NULL THEN
    bonus_restore := ABS(original_amount);
    purchased_restore := 0;
    demo_restore := 0;
  END IF;

  PERFORM public.materialize_demo_expiration_at(store_id_var, p_now);

  SELECT balance, bonus_balance, purchased_balance, demo_balance, demo_expires_at,
         demo_cycle_id, origin_demo_grant_tx_id, demo_contributing_tx_ids
  INTO current_balance, current_bonus, current_purchased, current_demo,
       cur_demo_expires, cur_demo_cycle, cur_demo_origin, cur_demo_contrib
  FROM public.credit_balances
  WHERE store_id = store_id_var
  FOR UPDATE;

  v_origin := COALESCE(cur_demo_origin, (original_metadata->>'origin_demo_grant_tx_id')::UUID);

  v_new_demo_expires := cur_demo_expires;
  v_new_demo_cycle := cur_demo_cycle;
  v_new_demo_contrib := cur_demo_contrib;

  IF demo_restore > 0 THEN
    IF v_origin IS NULL THEN
      bonus_restore := bonus_restore + demo_restore;
      demo_restore := 0;
    ELSIF cur_demo_expires IS NOT NULL AND cur_demo_expires > p_now THEN
      IF cur_demo_cycle IS DISTINCT FROM v_origin THEN
        v_new_demo_expires := GREATEST(cur_demo_expires, p_now + interval '24 hours');
      END IF;
      current_demo := current_demo + demo_restore;
    ELSE
      current_demo := current_demo + demo_restore;
      v_new_demo_expires := p_now + interval '24 hours';
      v_new_demo_cycle := gen_random_uuid();
    END IF;
  END IF;

  refund_amount := demo_restore + bonus_restore + purchased_restore;
  balance_before := current_balance;
  balance_after := current_balance + refund_amount;
  current_bonus := current_bonus + bonus_restore;
  current_purchased := current_purchased + purchased_restore;

  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    reason, reference, idempotency_key, metadata
  ) VALUES (
    store_id_var, 'refund', refund_amount, balance_before, balance_after,
    p_reason, p_tx_id::text, p_idempotency_key,
    p_metadata || jsonb_build_object(
      'demo_amount', demo_restore,
      'bonus_amount', bonus_restore,
      'purchased_amount', purchased_restore,
      'origin_demo_grant_tx_id', v_origin
    )
  )
  RETURNING id INTO tx_id;

  IF demo_restore > 0 THEN
    IF v_new_demo_cycle IS DISTINCT FROM cur_demo_cycle THEN
      v_new_demo_contrib := ARRAY[v_origin, tx_id];
    ELSE
      v_new_demo_contrib := v_new_demo_contrib || tx_id;
    END IF;
  END IF;

  UPDATE public.credit_balances
  SET demo_balance = current_demo,
      demo_expires_at = v_new_demo_expires,
      demo_cycle_id = v_new_demo_cycle,
      origin_demo_grant_tx_id = v_origin,
      demo_contributing_tx_ids = v_new_demo_contrib,
      bonus_balance = current_bonus,
      purchased_balance = current_purchased
  WHERE store_id = store_id_var;

  RETURN tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credit_at(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credit_at(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION public.refund_credit(
  p_tx_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.refund_credit_at(p_tx_id, p_reason, p_idempotency_key, p_metadata, now());
$$;

REVOKE ALL ON FUNCTION public.refund_credit(UUID, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credit(UUID, TEXT, TEXT, JSONB)
  TO service_role;

-- =============================================================================
-- REVERT (comentado)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.refund_credit(UUID, TEXT, TEXT, JSONB) FROM service_role;
-- DROP FUNCTION IF EXISTS public.refund_credit(UUID, TEXT, TEXT, JSONB);
-- REVOKE EXECUTE ON FUNCTION public.refund_credit_at(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM service_role;
-- DROP FUNCTION IF EXISTS public.refund_credit_at(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ);
-- REVOKE EXECUTE ON FUNCTION public.materialize_demo_expiration(UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.materialize_demo_expiration(UUID);
-- REVOKE EXECUTE ON FUNCTION public.materialize_demo_expiration_at(UUID, TIMESTAMPTZ) FROM service_role;
-- DROP FUNCTION IF EXISTS public.materialize_demo_expiration_at(UUID, TIMESTAMPTZ);
-- REVOKE EXECUTE ON FUNCTION public.process_trial_offer_installments(TIMESTAMPTZ) FROM service_role;
-- DROP FUNCTION IF EXISTS public.process_trial_offer_installments(TIMESTAMPTZ);
-- REVOKE EXECUTE ON FUNCTION public.grant_trial_offer_installment(UUID, INTEGER, TIMESTAMPTZ) FROM service_role;
-- DROP FUNCTION IF EXISTS public.grant_trial_offer_installment(UUID, INTEGER, TIMESTAMPTZ);
-- REVOKE EXECUTE ON FUNCTION public.start_trial_offer_enrollment(UUID, TIMESTAMPTZ) FROM service_role;
-- DROP FUNCTION IF EXISTS public.start_trial_offer_enrollment(UUID, TIMESTAMPTZ);
-- REVOKE EXECUTE ON FUNCTION public.record_onboarding_completion(UUID, TIMESTAMPTZ) FROM service_role;
-- DROP FUNCTION IF EXISTS public.record_onboarding_completion(UUID, TIMESTAMPTZ);
-- REVOKE EXECUTE ON FUNCTION public.trial_offer_eligibility(UUID, TIMESTAMPTZ) FROM service_role;
-- DROP FUNCTION IF EXISTS public.trial_offer_eligibility(UUID, TIMESTAMPTZ);
