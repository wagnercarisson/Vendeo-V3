-- Admin — Separar Test Store de Produção
-- Adiciona p_store_kind (production|test|all) nas RPCs de admin,
-- cria RPC admin_get_metrics com bundle JSONB, e protege grant_monthly_credits.
--
-- Blocos:
--   1. admin_get_users_summary — +p_store_kind (preserva p_verification_status)
--   2. admin_is_test_store — helper RPC
--   3. admin_get_metrics — bundle RPC (pipeline + VS + wallet)
--   4. grant_monthly_credits — +WHERE is_test_store = FALSE
--
-- Ordem obrigatória: DROP das funções existentes antes de CREATE OR REPLACE
-- porque as assinaturas mudaram (p_store_kind adicionado, admin_get_metrics é nova).

-- =============================================================================
-- 1. admin_get_users_summary — +p_store_kind
-- =============================================================================
-- A assinatura anterior (F33) tinha: (TEXT, INTEGER, INTEGER, TEXT)
-- A nova adiciona p_store_kind TEXT DEFAULT 'production' ao final.
-- DROP explícito da assinatura anterior para evitar overloads.

DROP FUNCTION IF EXISTS public.admin_get_users_summary(TEXT, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.admin_get_users_summary(TEXT, INTEGER, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_get_users_summary(
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_verification_status TEXT DEFAULT NULL,
  p_store_kind TEXT DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offset INTEGER;
  v_data JSONB;
  v_total BIGINT;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- COUNT total (com filtro opcional por store_kind)
  SELECT COUNT(*) INTO v_total
  FROM auth.users au
  LEFT JOIN public.stores s ON s.user_id = au.id
  WHERE (p_search IS NULL
    OR au.email ILIKE '%' || p_search || '%'
    OR s.name ILIKE '%' || p_search || '%'
    OR s.segment ILIKE '%' || p_search || '%')
  AND (p_verification_status IS NULL
    OR s.verification_status = p_verification_status)
  AND (CASE
    WHEN p_store_kind = 'production' THEN (s.is_test_store IS NULL OR s.is_test_store = FALSE)
    WHEN p_store_kind = 'test' THEN s.is_test_store = TRUE
    ELSE TRUE
  END);

  -- Dados paginados
  SELECT COALESCE(jsonb_agg(user_data ORDER BY user_data->>'createdAt' DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT jsonb_build_object(
      'userId', u.id,
      'email', u.email,
      'storeId', st.id,
      'storeName', st.name,
      'segment', st.segment,
      'balance', COALESCE(cb.balance, 0),
      'bonusBalance', COALESCE(cb.bonus_balance, 0),
      'purchasedBalance', COALESCE(cb.purchased_balance, 0),
      'totalCampaigns', COALESCE(c.cnt, 0),
      'errorCampaigns', COALESCE(ec.cnt, 0),
      'lastCampaignAt', cl.last_at,
      'createdAt', u.created_at,
      'verificationStatus', st.verification_status,
      'isTestStore', st.is_test_store
    ) AS user_data
    FROM auth.users u
    LEFT JOIN public.stores st ON st.user_id = u.id
    LEFT JOIN public.credit_balances cb ON cb.store_id = st.id
    LEFT JOIN (SELECT store_id, COUNT(*) AS cnt FROM public.campaigns GROUP BY store_id) c ON c.store_id = st.id
    LEFT JOIN (SELECT store_id, COUNT(*) AS cnt FROM public.campaigns WHERE status = 'error' GROUP BY store_id) ec ON ec.store_id = st.id
    LEFT JOIN (SELECT store_id, MAX(created_at) AS last_at FROM public.campaigns GROUP BY store_id) cl ON cl.store_id = st.id
    WHERE (p_search IS NULL
      OR u.email ILIKE '%' || p_search || '%'
      OR st.name ILIKE '%' || p_search || '%'
      OR st.segment ILIKE '%' || p_search || '%')
    AND (p_verification_status IS NULL
      OR st.verification_status = p_verification_status)
    AND (CASE
      WHEN p_store_kind = 'production' THEN (st.is_test_store IS NULL OR st.is_test_store = FALSE)
      WHEN p_store_kind = 'test' THEN st.is_test_store = TRUE
      ELSE TRUE
    END)
    ORDER BY u.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object('data', v_data, 'total', v_total);
END;
$$;

COMMENT ON FUNCTION public.admin_get_users_summary IS 'Retorna lista paginada de usuários com dados consolidados. p_store_kind: production (default) | test | all';

-- =============================================================================
-- 2. admin_is_test_store — helper RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_is_test_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_test BOOLEAN;
BEGIN
  SELECT is_test_store INTO v_is_test
  FROM public.stores
  WHERE id = p_store_id;

  RETURN COALESCE(v_is_test, FALSE);
END;
$$;

COMMENT ON FUNCTION public.admin_is_test_store IS 'Retorna TRUE se a loja for de teste. Usado para validações pontuais.';

-- =============================================================================
-- 3. admin_get_metrics — bundle RPC (pipeline + VS + wallet)
-- =============================================================================
-- Substitui N chamadas JS por uma única RPC que retorna JSONB com todos os
-- agregados. Aceita p_store_kind, p_hours, p_metric_type.
-- Inclui lógica cross-window de refunds (reference lookup sem filtro de janela).

DROP FUNCTION IF EXISTS public.admin_get_metrics(TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.admin_get_metrics(
  p_store_kind TEXT DEFAULT 'production',
  p_hours INTEGER DEFAULT 24,
  p_metric_type TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pipeline JSONB;
  v_vs JSONB;
  v_wallet JSONB;
  v_cutoff TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_cutoff := NOW() - (p_hours || ' hours')::INTERVAL;

  -- ─── Pipeline (campaign_pipeline) ──────────────────────────────
  IF p_metric_type IN ('all', 'pipeline') THEN
    WITH filtered_ge AS (
      SELECT ge.status, ge.estimated_cost_usd, ge.duration_ms, ge.user_id
      FROM public.generation_events ge
      JOIN public.stores s ON s.id = ge.store_id
        AND (CASE
          WHEN p_store_kind = 'production' THEN (s.is_test_store IS NULL OR s.is_test_store = FALSE)
          WHEN p_store_kind = 'test' THEN s.is_test_store = TRUE
          ELSE TRUE
        END)
      WHERE ge.generation_type = 'campaign_pipeline'
        AND ge.created_at >= v_cutoff
    ),
    aggregate AS (
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'success') AS success_count,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
        AVG(estimated_cost_usd) AS avg_cost,
        AVG(duration_ms) AS avg_duration,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS active_users
      FROM filtered_ge
    )
    SELECT jsonb_build_object(
      'total', COALESCE(total, 0),
      'success', COALESCE(success_count, 0),
      'error', COALESCE(failed_count, 0),
      'avg_cost_ms', avg_cost,
      'avg_duration_ms', avg_duration,
      'active_users', COALESCE(active_users, 0)
    ) INTO v_pipeline
    FROM aggregate;
  ELSE
    v_pipeline := '{}'::jsonb;
  END IF;

  -- ─── Visual Signature (VS) ─────────────────────────────────────
  IF p_metric_type IN ('all', 'pipeline') THEN
    WITH filtered_vs AS (
      SELECT ge.status, ge.duration_ms
      FROM public.generation_events ge
      JOIN public.stores s ON s.id = ge.store_id
        AND (CASE
          WHEN p_store_kind = 'production' THEN (s.is_test_store IS NULL OR s.is_test_store = FALSE)
          WHEN p_store_kind = 'test' THEN s.is_test_store = TRUE
          ELSE TRUE
        END)
      WHERE ge.generation_type = 'visual_signature'
        AND ge.created_at >= v_cutoff
    ),
    aggregate AS (
      SELECT
        COUNT(*) FILTER (WHERE status = 'success') AS success_count,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
        AVG(duration_ms) AS avg_duration
      FROM filtered_vs
    )
    SELECT jsonb_build_object(
      'success_rate', CASE WHEN (SELECT COUNT(*) FROM filtered_vs) > 0
        THEN ROUND((success_count::NUMERIC / NULLIF((SELECT COUNT(*) FROM filtered_vs), 0)) * 100)
        ELSE NULL END,
      'error_rate', CASE WHEN (SELECT COUNT(*) FROM filtered_vs) > 0
        THEN ROUND((failed_count::NUMERIC / NULLIF((SELECT COUNT(*) FROM filtered_vs), 0)) * 100)
        ELSE 0 END,
      'avg_duration_ms', avg_duration
    ) INTO v_vs
    FROM aggregate;
  ELSE
    v_vs := '{}'::jsonb;
  END IF;

  -- ─── Wallet / Créditos ─────────────────────────────────────────
  IF p_metric_type IN ('all', 'wallet') THEN
    WITH filtered_ct AS (
      SELECT ct.id, ct.type, ct.amount, ct.campaign_id, ct.metadata, ct.reference
      FROM public.credit_transactions ct
      JOIN public.stores s ON s.id = ct.store_id
        AND (CASE
          WHEN p_store_kind = 'production' THEN (s.is_test_store IS NULL OR s.is_test_store = FALSE)
          WHEN p_store_kind = 'test' THEN s.is_test_store = TRUE
          ELSE TRUE
        END)
      WHERE ct.created_at >= v_cutoff
    ),
    -- Créditos concedidos (grant types)
    credits_granted_agg AS (
      SELECT COALESCE(SUM(amount), 0) AS total_granted
      FROM filtered_ct
      WHERE type IN ('bonus_onboarding', 'bonus_monthly', 'admin_grant', 'purchase')
    ),
    -- Créditos VS consumidos (deduction com feature visual_signature)
    vs_consumed_agg AS (
      SELECT COALESCE(SUM(ABS(amount)), 0) AS total_consumed
      FROM filtered_ct
      WHERE type = 'deduction' AND metadata->>'feature' = 'visual_signature'
    ),
    -- Refunds: classificação com cross-window
    -- 1ª passada: refunds dentro da janela com referência a deduction também dentro da janela
    window_refunds AS (
      SELECT r.id, r.amount, r.reference, r.metadata
      FROM filtered_ct r
      WHERE r.type = 'refund'
    ),
    window_deductions AS (
      SELECT d.id, d.metadata
      FROM filtered_ct d
      WHERE d.type = 'deduction'
    ),
    -- 2ª passada (cross-window): refunds cuja deduction referenciada está fora da janela
    orphan_refunds AS (
      SELECT wr.id, wr.amount, wr.reference, wr.metadata
      FROM window_refunds wr
      WHERE wr.reference IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM window_deductions wd WHERE wd.id = wr.reference)
    ),
    cross_window_deductions AS (
      SELECT ct.id, ct.metadata
      FROM public.credit_transactions ct
      WHERE ct.type = 'deduction'
        AND ct.id IN (SELECT or2.reference FROM orphan_refunds or2)
    ),
    -- Classificar refunds de campanha
    campaign_refunds AS (
      SELECT wr.id, wr.amount
      FROM window_refunds wr
      WHERE wr.reference IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM window_deductions wd WHERE wd.id = wr.reference
            AND ((wd.metadata->>'feature' IS NULL AND EXISTS (
              SELECT 1 FROM public.campaigns c WHERE c.id = (SELECT campaign_id FROM window_deductions wd2 WHERE wd2.id = wr.reference LIMIT 1)
            )) OR wd.metadata->>'feature' = 'campaign_pipeline'))
          OR EXISTS (SELECT 1 FROM cross_window_deductions cwd WHERE cwd.id = wr.reference
            AND ((cwd.metadata->>'feature' IS NULL) OR cwd.metadata->>'feature' = 'campaign_pipeline'))
        )
    ),
    -- Classificar refunds de VS
    vs_refunds AS (
      SELECT wr.id, wr.amount
      FROM window_refunds wr
      WHERE wr.reference IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM window_deductions wd WHERE wd.id = wr.reference
            AND wd.metadata->>'feature' = 'visual_signature')
          OR EXISTS (SELECT 1 FROM cross_window_deductions cwd WHERE cwd.id = wr.reference
            AND cwd.metadata->>'feature' = 'visual_signature')
        )
    ),
    -- Refunds com metadata.feature direto (sem reference chain)
    direct_feature_refunds AS (
      SELECT r.id, r.amount, r.metadata
      FROM window_refunds r
      WHERE r.metadata->>'feature' IN ('campaign_pipeline', 'visual_signature')
    ),
    -- Totais
    campaign_deduction_count AS (
      SELECT COUNT(*) AS cnt FROM window_deductions
      WHERE metadata->>'feature' = 'campaign_pipeline'
        OR (metadata->>'feature' IS NULL AND id IN (
          SELECT id FROM window_deductions wd2 WHERE EXISTS (
            SELECT 1 FROM public.campaigns c WHERE c.id = wd2.campaign_id
          )
        ))
    ),
    vs_deduction_count AS (
      SELECT COUNT(*) AS cnt FROM window_deductions
      WHERE metadata->>'feature' = 'visual_signature'
    )
    SELECT jsonb_build_object(
      'credits_granted', (SELECT total_granted FROM credits_granted_agg),
      'credits_consumed_vs', (SELECT total_consumed FROM vs_consumed_agg),
      'refund_rate', CASE WHEN (SELECT cnt FROM campaign_deduction_count) > 0
        THEN ROUND(((SELECT COUNT(*)::NUMERIC FROM campaign_refunds) / NULLIF((SELECT cnt::NUMERIC FROM campaign_deduction_count), 0)) * 100)
        ELSE 0 END,
      'vs_credits_consumed', (SELECT total_consumed FROM vs_consumed_agg),
      'vs_credits_refunded', COALESCE((SELECT SUM(ABS(amount)) FROM vs_refunds), 0)
        + COALESCE((SELECT SUM(ABS(amount)) FROM direct_feature_refunds WHERE metadata->>'feature' = 'visual_signature' AND id NOT IN (SELECT id FROM vs_refunds)), 0),
      'vs_refund_rate', CASE WHEN (SELECT cnt FROM vs_deduction_count) > 0
        THEN ROUND(((SELECT COUNT(*)::NUMERIC FROM vs_refunds) / NULLIF((SELECT cnt::NUMERIC FROM vs_deduction_count), 0)) * 100)
        ELSE 0 END,
      'credits_consumed', (SELECT total_consumed FROM vs_consumed_agg),
      'credits_refunded_campaign', COALESCE((SELECT SUM(ABS(amount)) FROM campaign_refunds), 0)
        + COALESCE((SELECT SUM(ABS(amount)) FROM direct_feature_refunds WHERE metadata->>'feature' = 'campaign_pipeline' AND id NOT IN (SELECT id FROM campaign_refunds)), 0)
    ) INTO v_wallet;
  ELSE
    v_wallet := '{}'::jsonb;
  END IF;

  v_result := jsonb_build_object(
    'pipeline', v_pipeline,
    'vs', v_vs,
    'wallet', v_wallet
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_get_metrics IS 'Retorna bundle JSONB com métricas de pipeline, VS e wallet. p_store_kind: production|test|all. p_hours: janela em horas. p_metric_type: all|pipeline|wallet';

-- =============================================================================
-- 4. grant_monthly_credits — +WHERE is_test_store = FALSE
-- =============================================================================
-- Adiciona AND s.is_test_store = FALSE para não conceder créditos mensais
-- para lojas de teste. Preserva toda a lógica de entitlement existente.

CREATE OR REPLACE FUNCTION public.grant_monthly_credits(
  p_amount INTEGER,
  p_bonus_cap INTEGER,
  p_min_store_age_days INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store RECORD;
  v_granted INTEGER := 0;
  v_skipped_no_cnpj INTEGER := 0;
  v_skipped_already_granted INTEGER := 0;
  v_insufficient_bonus_cap INTEGER := 0;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
  v_cycle TEXT;
  v_new_balance INTEGER;
  v_results JSONB[];
BEGIN
  v_cycle := TO_CHAR(NOW(), 'YYYY-MM');

  FOR v_store IN
    SELECT s.id, s.user_id, s.created_at, cb.bonus_balance, s.cnpj_root_hash
    FROM public.stores s
    JOIN public.credit_balances cb ON cb.store_id = s.id
    WHERE (s.cnpj_root_hash IS NOT NULL AND s.cnpj_root_hash != '')
      AND cb.bonus_balance < p_bonus_cap
      AND s.created_at <= (NOW() - (p_min_store_age_days || ' days')::INTERVAL)
      AND s.is_test_store = FALSE
      AND EXISTS (
        SELECT 1 FROM public.credit_transactions ct
        WHERE ct.store_id = s.id AND ct.type IN ('bonus_onboarding', 'bonus_monthly')
        HAVING COUNT(*) > 0
      )
    FOR UPDATE OF cb SKIP LOCKED
  LOOP
    v_entitlement_id := public.try_grant_monthly_entitlement(v_store.id, v_store.cnpj_root_hash, v_cycle);

    IF v_entitlement_id IS NULL THEN
      v_skipped_already_granted := v_skipped_already_granted + 1;
      CONTINUE;
    END IF;

    v_grant_tx_id := public.grant_credits(
      v_store.id, p_amount, 'credito_mensal',
      'mensal_' || v_cycle || '_' || v_store.id,
      jsonb_build_object('cycle', v_cycle, 'source', 'monthly_cron'),
      'bonus_monthly'
    );

    UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
    WHERE id = v_entitlement_id;

    v_granted := v_granted + 1;
  END LOOP;

  SELECT COALESCE(bonus_balance, 0) INTO v_new_balance
  FROM public.credit_balances WHERE store_id = v_store.id;

  RETURN jsonb_build_object(
    'granted', v_granted,
    'skipped_no_cnpj', v_skipped_no_cnpj,
    'skipped_already_granted', v_skipped_already_granted,
    'insufficient_bonus_cap', v_insufficient_bonus_cap
  );
END;
$$;

-- =============================================================================
-- REVERT
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.admin_get_users_summary CASCADE;
-- DROP FUNCTION IF EXISTS public.admin_is_test_store CASCADE;
-- DROP FUNCTION IF EXISTS public.admin_get_metrics CASCADE;
-- DROP FUNCTION IF EXISTS public.grant_monthly_credits CASCADE;
-- CREATE OR REPLACE FUNCTION public.admin_get_users_summary(p_search TEXT DEFAULT NULL, p_page INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 20, p_verification_status TEXT DEFAULT NULL) RETURNS JSONB ... (ver F33)
-- CREATE OR REPLACE FUNCTION public.grant_monthly_credits(p_amount INTEGER, p_bonus_cap INTEGER, p_min_store_age_days INTEGER) RETURNS JSONB ... (ver F27)
