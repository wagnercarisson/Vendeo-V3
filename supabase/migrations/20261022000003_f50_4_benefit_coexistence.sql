-- =============================================================================
-- F50.4 — Oferta de onboarding individualizada por CNPJ completo
-- Migration M3/3: coexistência da demo/mensal legados e protocolo de locks de
-- raiz em grant_demo_credits, grant_monthly_credits e
-- admin_grant_freemium_exception.
--
-- Escopo:
--   1. grant_demo_credits: loja FOR UPDATE -> advisory de raiz -> gate por
--      launch_at -> barreira SOMENTE root_legacy/mesmo CNPJ -> saldo.
--   2. grant_monthly_credits: iteração ORDER BY cnpj_root_hash; recipiente
--      determinístico root_legacy sem enrollment próprio; loja FOR UPDATE antes
--      do advisory; subtransação P5040 decide o limiar de saldo sem inverter a
--      ordem loja -> raiz -> constraint -> saldo.
--   3. admin_grant_freemium_exception: loja FOR UPDATE -> advisory -> insert;
--      correção do gap de privilégio (REVOKE/GRANT service_role).
--
-- Regras:
--   - Nenhuma migration é aplicada por este arquivo em produção.
--   - Valores da demo (10/168), assinaturas e defaults NÃO mudam.
--   - Nenhum saldo, transação, entitlement, data ou parcela é reescrito.
--   - Filial per_cnpj_f50_4 nunca recebe bonus_monthly e nunca reduz o direito
--     legado da matriz.
--   - grant_trial_offer_installment, materialize_demo_expiration_at,
--     refund_credit_at e admin_grant_credits NÃO são redefinidos aqui.
-- =============================================================================

-- =============================================================================
-- 1. grant_demo_credits — coorte, advisory de raiz e barreira por beneficiário
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
  v_store RECORD;
  v_root_hash TEXT;
  v_cnpj_normalized TEXT;
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

  -- Protocolo de raiz: loja FOR UPDATE ANTES do advisory.
  SELECT s.id, s.user_id, s.cnpj_root_hash, s.cnpj_normalized
  INTO v_store
  FROM public.stores s
  WHERE s.id = p_store_id
  FOR UPDATE;

  IF v_store.id IS NULL THEN
    -- Loja pode não existir: preserva o comportamento anterior (decisões caem
    -- para o root_hash informado e as checagens existentes seguem valendo).
    v_root_hash := p_root_hash;
    v_cnpj_normalized := NULL;
  ELSE
    v_root_hash := COALESCE(NULLIF(btrim(v_store.cnpj_root_hash), ''), p_root_hash);
    v_cnpj_normalized := v_store.cnpj_normalized;
  END IF;

  IF v_root_hash IS NOT NULL AND btrim(v_root_hash) <> '' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('vendeo:benefit:' || v_root_hash, 0)
    );
  END IF;

  -- Coorte da oferta de 28 dias: decisão por launch_at (NUNCA por enabled nem
  -- por individual_launch_at).
  SELECT launch_at INTO v_launch_at
  FROM public.trial_offer_settings
  WHERE offer_key = 'trial_28d_v1';

  IF v_launch_at IS NOT NULL AND v_store.user_id IS NOT NULL THEN
    SELECT au.created_at INTO v_account_created_at
    FROM auth.users au
    WHERE au.id = v_store.user_id;

    IF v_account_created_at IS NOT NULL AND v_account_created_at >= v_launch_at THEN
      RETURN jsonb_build_object('granted', false, 'reason', 'trial_offer_applies');
    END IF;
  END IF;

  -- Barreira legada: SOMENTE enrollment root_legacy da raiz, enrollment da
  -- própria loja ou enrollment do MESMO CNPJ completo. Enrollment
  -- per_cnpj_f50_4 de outro CNPJ nunca bloqueia a conta anterior.
  IF EXISTS (
    SELECT 1
    FROM public.trial_offer_enrollments e
    WHERE e.store_id = p_store_id
       OR (
         v_cnpj_normalized IS NOT NULL
         AND e.beneficiary_cnpj_normalized = v_cnpj_normalized
       )
       OR (
         v_root_hash IS NOT NULL
         AND e.root_hash = v_root_hash
         AND e.policy_cohort = 'root_legacy'
       )
  ) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'trial_offer_consumed');
  END IF;

  -- Elegibilidade ANTES de qualquer INSERT (evita entitlement demo órfão)
  IF EXISTS (SELECT 1 FROM public.freemium_entitlements
             WHERE root_hash = v_root_hash AND benefit_type = 'onboarding') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'onboarding_consumed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.freemium_entitlements
             WHERE root_hash = v_root_hash AND benefit_type = 'admin_exception') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'admin_exception_consumed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.freemium_entitlements
             WHERE store_id = p_store_id AND benefit_type = 'admin_exception') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'admin_exception_consumed');
  END IF;

  v_entitlement_id := public.try_grant_demo_entitlement(p_store_id, v_root_hash);

  IF v_entitlement_id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_granted');
  END IF;

  v_demo_expires_at := now() + make_interval(hours => p_ttl_hours);

  SELECT user_id INTO v_user_id FROM public.stores WHERE id = p_store_id;

  -- Saldo por ÚLTIMO (grant_credits adquire credit_balances FOR UPDATE).
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
-- 2. grant_monthly_credits — ordem de locks e coexistência com a F50.4
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
  v_recipient_user UUID;
  v_recipient_bonus INTEGER;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
  v_already_granted BOOLEAN;
  v_cap_reached BOOLEAN;
  v_new_policy_stores INTEGER;
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
  v_skipped_new_policy_store INTEGER := 0;
BEGIN
  v_ref_date := COALESCE(p_reference_date, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_cycle := TO_CHAR(v_ref_date, 'YYYY-MM');

  SELECT COUNT(*) INTO v_skipped_no_cnpj
  FROM public.stores s
  WHERE s.is_test_store = FALSE
    AND (s.cnpj_root_hash IS NULL OR s.cnpj_root_hash = '');

  -- Iteração determinística por raiz: ORDER BY evita ordens de aquisição
  -- divergentes entre execuções concorrentes do cron.
  FOR v_root_hash IN
    SELECT DISTINCT s.cnpj_root_hash
    FROM public.stores s
    WHERE s.cnpj_root_hash IS NOT NULL
      AND s.cnpj_root_hash != ''
      AND s.is_test_store = FALSE
    ORDER BY s.cnpj_root_hash
  LOOP
    v_roots_considered := v_roots_considered + 1;

    -- Exclusão da raiz SOMENTE por enrollment root_legacy (mesmo vencido).
    -- Enrollment per_cnpj_f50_4 de outra filial não exclui a raiz legada.
    IF EXISTS (
      SELECT 1 FROM public.trial_offer_enrollments e
      WHERE e.root_hash = v_root_hash
        AND e.policy_cohort='root_legacy'
    ) THEN
      v_skipped_trial_offer_cohort := v_skipped_trial_offer_cohort + 1;
      CONTINUE;
    END IF;

    SELECT COUNT(*) INTO v_new_policy_stores
    FROM public.stores s
    WHERE s.cnpj_root_hash = v_root_hash
      AND s.is_test_store = FALSE
      AND public.trial_offer_policy_cohort(s.user_id) = 'per_cnpj_f50_4';

    -- Recipiente determinístico ANTES do advisory: matriz preferida, senão a
    -- loja mais antiga; elegível apenas na coorte root_legacy e sem enrollment
    -- próprio. Loja per_cnpj_f50_4 NUNCA é recipiente do bonus_monthly.
    SELECT s.id, s.created_at
    INTO v_recipient
    FROM public.stores s
    WHERE s.cnpj_root_hash = v_root_hash
      AND s.is_test_store = FALSE
      AND public.trial_offer_policy_cohort(s.user_id) = 'root_legacy'
      AND NOT EXISTS (
        SELECT 1 FROM public.trial_offer_enrollments e
        WHERE e.store_id = s.id
      )
    ORDER BY CASE WHEN substring(s.cnpj_normalized, 9, 4) = '0001' THEN 0 ELSE 1 END,
             s.created_at ASC, s.id ASC
    LIMIT 1;

    IF v_recipient.id IS NULL THEN
      -- Raiz só com lojas da nova coorte: nenhum grant/entitlement.
      IF v_new_policy_stores > 0 THEN
        v_skipped_new_policy_store := v_skipped_new_policy_store + 1;
      ELSE
        v_skipped_not_due := v_skipped_not_due + 1;
      END IF;
      CONTINUE;
    END IF;

    -- Ordem do protocolo: loja FOR UPDATE -> advisory de raiz -> constraint
    -- -> credit_balances FOR UPDATE (por último).
    PERFORM 1 FROM public.stores WHERE id = v_recipient.id FOR UPDATE;

    PERFORM pg_advisory_xact_lock(
      hashtextextended('vendeo:benefit:' || v_root_hash, 0)
    );

    -- Revalidação pós-advisory: a coorte/inscrição do recipiente pode ter
    -- mudado enquanto o advisory era aguardado.
    SELECT s.user_id INTO v_recipient_user
    FROM public.stores s
    WHERE s.id = v_recipient.id;

    IF public.trial_offer_policy_cohort(v_recipient_user) <> 'root_legacy'
       OR EXISTS (
         SELECT 1 FROM public.trial_offer_enrollments e
         WHERE e.store_id = v_recipient.id
       )
       OR EXISTS (
         SELECT 1 FROM public.trial_offer_enrollments e
         WHERE e.root_hash = v_root_hash
           AND e.policy_cohort = 'root_legacy'
       ) THEN
      v_skipped_trial_offer_cohort := v_skipped_trial_offer_cohort + 1;
      CONTINUE;
    END IF;

    -- Histórico freemium validado NO NÍVEL DA RAIZ.
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

    -- Idade mínima por dia civil BR.
    IF (v_recipient.created_at AT TIME ZONE 'America/Sao_Paulo')::date > (v_ref_date - p_min_store_age_days) THEN
      v_skipped_not_due := v_skipped_not_due + 1;
      CONTINUE;
    END IF;

    -- Ciclo por aniversário com clamp de dia 29/30/31.
    v_anniv_day := EXTRACT(DAY FROM (v_recipient.created_at AT TIME ZONE 'America/Sao_Paulo'));
    v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_ref_date) + INTERVAL '1 month - 1 day'));
    v_grant_day := LEAST(v_anniv_day, v_last_day);

    IF EXTRACT(DAY FROM v_ref_date) <> v_grant_day THEN
      v_skipped_not_due := v_skipped_not_due + 1;
      CONTINUE;
    END IF;

    -- Row garantida em credit_balances (idempotente, sem lock).
    INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance)
    VALUES (v_recipient.id, 0, 0, 0)
    ON CONFLICT (store_id) DO NOTHING;

    v_entitlement_id := NULL;
    v_grant_tx_id := NULL;
    v_already_granted := false;
    v_cap_reached := false;

    -- Subtransação PL/pgSQL: a decisão do limiar usa o saldo travado DEPOIS do
    -- entitlement, mantendo a ordem loja -> raiz -> constraint -> saldo. O
    -- rollback implícito de P5040 remove o entitlement quando o limiar bloqueia.
    BEGIN
      v_entitlement_id := public.try_grant_monthly_entitlement(v_recipient.id, v_root_hash, v_cycle);

      IF v_entitlement_id IS NULL THEN
        v_already_granted := true;
      ELSE
        SELECT cb.bonus_balance INTO v_recipient_bonus
        FROM public.credit_balances cb
        WHERE cb.store_id = v_recipient.id
        FOR UPDATE;

        IF v_recipient_bonus >= p_bonus_cap THEN
          RAISE EXCEPTION 'f50_4_monthly_cap_reached' USING ERRCODE = 'P5040';
        END IF;

        v_grant_tx_id := public.grant_credits(
          v_recipient.id, p_amount, 'credito_mensal',
          'mensal_' || v_cycle || '_' || v_root_hash,
          jsonb_build_object('cycle', v_cycle, 'source', 'monthly_cron'),
          'bonus_monthly'
        );

        UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
        WHERE id = v_entitlement_id;
      END IF;
    EXCEPTION WHEN SQLSTATE 'P5040' THEN
      -- Captura SOMENTE o limiar de saldo; erros inesperados propagam.
      v_cap_reached := true;
      v_entitlement_id := NULL;
      v_grant_tx_id := NULL;
      v_skipped_bonus_threshold := v_skipped_bonus_threshold + 1;
    END;

    IF v_already_granted THEN
      v_skipped_already_granted := v_skipped_already_granted + 1;
      CONTINUE;
    END IF;

    IF v_cap_reached THEN
      CONTINUE;
    END IF;

    IF v_grant_tx_id IS NOT NULL THEN
      v_granted := v_granted + 1;
    END IF;
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
      'skipped_trial_offer_cohort', v_skipped_trial_offer_cohort,
      'skipped_new_policy_store', v_skipped_new_policy_store
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_monthly_credits(INTEGER, INTEGER, INTEGER, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits(INTEGER, INTEGER, INTEGER, DATE)
  TO service_role;

-- =============================================================================
-- 3. admin_grant_freemium_exception — loja -> advisory e privilégio mínimo
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_grant_freemium_exception(
  p_store_id UUID,
  p_reason TEXT,
  p_granted_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store RECORD;
  v_root_hash TEXT;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
BEGIN
  -- Loja FOR UPDATE ANTES do advisory de raiz.
  SELECT s.id, s.cnpj_root_hash INTO v_store
  FROM public.stores s
  WHERE s.id = p_store_id
  FOR UPDATE;

  IF v_store.id IS NULL THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  v_root_hash := v_store.cnpj_root_hash;
  IF v_root_hash IS NULL OR v_root_hash = '' THEN
    v_root_hash := 'admin_exception_no_cnpj';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('vendeo:benefit:' || v_root_hash, 0)
  );

  -- Unicidade legada (root_hash, benefit_type, cycle) preservada: sem
  -- ON CONFLICT, para que a exceção não concedida não seja mascarada.
  INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason, granted_by)
  VALUES (p_store_id, v_root_hash, 'admin_exception', p_reason, p_granted_by)
  RETURNING id INTO v_entitlement_id;

  SELECT public.grant_credits(
    p_store_id, 10, p_reason,
    'admin_exception_' || v_entitlement_id,
    jsonb_build_object('source', 'admin_exception', 'entitlement_id', v_entitlement_id),
    'admin_grant'
  ) INTO v_grant_tx_id;

  UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
  WHERE id = v_entitlement_id;

  INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
  VALUES ('credit_grant', 'store', p_store_id, p_granted_by, p_reason,
    jsonb_build_object(
      'grant_type', 'freemium_exception',
      'entitlement_id', v_entitlement_id,
      'grant_transaction_id', v_grant_tx_id
    ));

  RETURN jsonb_build_object(
    'success', true,
    'entitlement_id', v_entitlement_id,
    'grant_transaction_id', v_grant_tx_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_freemium_exception(UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_freemium_exception(UUID, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- REVERT (comentado) — recompõe o estado das migrations anteriores
-- =============================================================================
-- Recriar grant_demo_credits e grant_monthly_credits a partir de
-- 20261020000004_f50_2_trial_offer_precedence.sql e
-- admin_grant_freemium_exception a partir de
-- 20260727000001_freemium_anti_abuso_cnpj.sql.
--
-- REVOKE ALL ON FUNCTION public.admin_grant_freemium_exception(UUID, TEXT, UUID)
--   FROM service_role;
-- (o REVERT não restaura EXECUTE para PUBLIC: o privilégio mínimo é permanente)
