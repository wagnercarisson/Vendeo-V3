-- F38.2 AJUSTE — admin_get_ai_operation_runs: MIN(uuid) → subqueries correlacionadas
-- =============================================================================
-- Correção pós-push (validação funcional via REST detectou `function min(uuid)
-- does not exist`): o PostgreSQL não tem agregado MIN/MAX para UUID. A CTE
-- `runs` usava MIN(store_id)/MIN(campaign_id)/MIN(visual_signature_id) — o
-- CREATE OR REPLACE abaixo troca por subqueries correlacionadas que resolvem o
-- primeiro valor não-nulo por operation_run_id (ordenado por created_at ASC).
-- Apenas o RPC de lista é redefinido; admin_get_ai_operation_run_events
-- (detalhe) não usa MIN/MAX em UUID e permanece como na 20260810000003.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_get_ai_operation_runs(
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_store_id UUID,
  p_run_type TEXT,
  p_status TEXT,
  p_provider TEXT,
  p_model TEXT,
  p_generation_type TEXT,
  p_operation_run_id UUID,
  p_page INTEGER,
  p_page_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_page INTEGER;
  v_page_size INTEGER;
  v_result JSONB;
BEGIN
  -- Janela operacional máxima de 365 dias (anti-DoS — T-38.2-06)
  IF p_period_start IS NOT NULL AND p_period_end IS NOT NULL
     AND (p_period_end - p_period_start) > INTERVAL '365 days' THEN
    RAISE EXCEPTION 'window_exceeded_365d';
  END IF;

  v_page := COALESCE(p_page, 1);
  IF v_page < 1 THEN
    v_page := 1;
  END IF;

  v_page_size := COALESCE(p_page_size, 25);
  IF v_page_size < 1 THEN
    v_page_size := 25;
  END IF;
  IF v_page_size > 100 THEN
    v_page_size := 100;
  END IF;

  WITH call_level AS (
    SELECT
      ge.operation_run_id,
      ge.operation_run_type,
      ge.store_id,
      ge.campaign_id,
      ge.visual_signature_id,
      ge.generation_type,
      ge.provider,
      ge.model,
      ge.status,
      ge.attempt_number,
      ge.duration_ms,
      ge.cost_source,
      ge.cost_estimation_note,
      ge.created_at,
      COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd) AS accounting_cost_usd
    FROM public.generation_events ge
    WHERE ge.operation_run_id IS NOT NULL
      AND ge.generation_type NOT IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo')
      AND (p_period_start IS NULL OR ge.created_at >= p_period_start)
      AND (p_period_end IS NULL OR ge.created_at <= p_period_end)
      AND (p_store_id IS NULL OR ge.store_id = p_store_id)
      AND (p_run_type IS NULL OR ge.operation_run_type = p_run_type)
      AND (p_provider IS NULL OR ge.provider = p_provider)
      AND (p_model IS NULL OR ge.model = p_model)
      AND (p_generation_type IS NULL OR ge.generation_type = p_generation_type)
      AND (p_operation_run_id IS NULL OR ge.operation_run_id = p_operation_run_id)
  ),
  runs AS (
    SELECT
      cl.operation_run_id,
      MIN(cl.operation_run_type) AS operation_run_type,
      (SELECT cl_s.store_id FROM call_level cl_s
       WHERE cl_s.operation_run_id = cl.operation_run_id
         AND cl_s.store_id IS NOT NULL
       ORDER BY cl_s.created_at ASC
       LIMIT 1) AS store_id,
      (SELECT cl_c.campaign_id FROM call_level cl_c
       WHERE cl_c.operation_run_id = cl.operation_run_id
         AND cl_c.campaign_id IS NOT NULL
       ORDER BY cl_c.created_at ASC
       LIMIT 1) AS campaign_id,
      (SELECT cl_v.visual_signature_id FROM call_level cl_v
       WHERE cl_v.operation_run_id = cl.operation_run_id
         AND cl_v.visual_signature_id IS NOT NULL
       ORDER BY cl_v.created_at ASC
       LIMIT 1) AS visual_signature_id,
      MIN(cl.created_at) AS created_at,
      (SELECT delivery.status
       FROM public.generation_events delivery
       WHERE delivery.operation_run_id = cl.operation_run_id
         AND delivery.generation_type IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo')
       ORDER BY delivery.created_at DESC
       LIMIT 1) AS delivery_status,
      SUM(cl.accounting_cost_usd) AS custo_usd_total,
      SUM(cl.duration_ms) AS duracao_total_ms,
      COUNT(*) AS chamadas,
      COUNT(*) FILTER (WHERE cl.status = 'success') AS chamadas_success,
      GREATEST(
        COALESCE(MAX(cl.attempt_number) FILTER (
          WHERE cl.generation_type IN (
            'campaign_image','campaign_image_review',
            'visual_signature_image','visual_signature_validation'
          )
        ), 0) - 1,
        0
      ) AS regeneracoes,
      (SELECT cl2.provider
       FROM call_level cl2
       WHERE cl2.operation_run_id = cl.operation_run_id
       GROUP BY cl2.provider
       ORDER BY COUNT(*) DESC, MIN(cl2.created_at) DESC
       LIMIT 1) AS provider,
      (SELECT cl3.model
       FROM call_level cl3
       WHERE cl3.operation_run_id = cl.operation_run_id
       GROUP BY cl3.model
       ORDER BY COUNT(*) DESC, MIN(cl3.created_at) DESC
       LIMIT 1) AS model,
      (SELECT cl4.cost_source
       FROM call_level cl4
       WHERE cl4.operation_run_id = cl.operation_run_id
         AND cl4.cost_source IS NOT NULL
       GROUP BY cl4.cost_source
       ORDER BY COUNT(*) DESC
       LIMIT 1) AS cost_source,
      array_agg(DISTINCT cl.cost_source) FILTER (WHERE cl.cost_source IS NOT NULL) AS cost_sources,
      array_agg(DISTINCT cl.cost_estimation_note) FILTER (WHERE cl.cost_estimation_note IS NOT NULL) AS cost_estimation_notes,
      BOOL_OR(cl.cost_source = 'provider_reported') AS has_provider_reported,
      BOOL_OR(cl.cost_source = 'pricing_table'
              AND cl.cost_estimation_note = 'provisional_image_tool_unit_cost_until_provider_reconciliation') AS has_provisional_image_estimate,
      BOOL_OR(cl.cost_source = 'manual_unknown'
              OR (cl.cost_source = 'pricing_table'
                  AND cl.cost_estimation_note = 'responses_image_generation_tool_without_unit_pricing')) AS has_partial_estimate,
      BOOL_OR(cl.cost_source = 'not_available') AS has_not_available,
      BOOL_OR(cl.cost_source IN ('pricing_table','fallback_static')) AS has_estimated
    FROM call_level cl
    GROUP BY cl.operation_run_id
  ),
  filtered_runs AS (
    SELECT
      r.operation_run_id,
      r.operation_run_type,
      r.store_id,
      r.campaign_id,
      r.visual_signature_id,
      r.created_at,
      r.delivery_status,
      r.custo_usd_total,
      r.duracao_total_ms,
      r.chamadas,
      r.chamadas_success,
      r.regeneracoes,
      r.provider,
      r.model,
      r.cost_source,
      r.cost_sources,
      r.cost_estimation_notes,
      r.has_provider_reported,
      r.has_provisional_image_estimate,
      r.has_partial_estimate,
      r.has_not_available,
      r.has_estimated,
      -- Reuso da view de reconciliação (F38.1): créditos debitados por entrega
      COALESCE(vc.creditos_debitados, 0) AS creditos_debitados,
      -- Evidências brutas de segmento (D9) — RPC NÃO classifica
      s.is_test_store AS is_test_flag,
      de.deduction_purchased_amount,
      de.deduction_bonus_amount,
      CASE WHEN sag.grant_count > 0
           THEN jsonb_build_object('grant_count', sag.grant_count)
           ELSE NULL
      END AS admin_grant_evidence
    FROM runs r
    LEFT JOIN public.admin_cost_vs_credits vc
      ON vc.operation_run_id = r.operation_run_id
    LEFT JOIN public.stores s
      ON s.id = r.store_id
    LEFT JOIN (
      SELECT
        de_all.operation_run_id,
        SUM(de_all.purchased) AS deduction_purchased_amount,
        SUM(de_all.bonus) AS deduction_bonus_amount
      FROM (
        -- Deductions de campanha (feature campaign_pipeline) — sem multiplicar
        -- por eventos do run (DISTINCT por campaign_id no run)
        SELECT
          cr.operation_run_id,
          COALESCE((ct.metadata->>'purchased_amount')::NUMERIC, 0) AS purchased,
          COALESCE((ct.metadata->>'bonus_amount')::NUMERIC, 0) AS bonus
        FROM public.credit_transactions ct
        JOIN (
          SELECT DISTINCT ge_c.campaign_id, ge_c.operation_run_id
          FROM public.generation_events ge_c
          WHERE ge_c.campaign_id IS NOT NULL
            AND ge_c.operation_run_id IS NOT NULL
        ) cr ON cr.campaign_id = ct.campaign_id
        WHERE ct.type = 'deduction'
          AND ct.metadata->>'feature' = 'campaign_pipeline'
        UNION ALL
        -- Deductions de visual_signature (via credit_tx_id em svs.metadata)
        SELECT
          vr.operation_run_id,
          COALESCE((ct2.metadata->>'purchased_amount')::NUMERIC, 0) AS purchased,
          COALESCE((ct2.metadata->>'bonus_amount')::NUMERIC, 0) AS bonus
        FROM public.credit_transactions ct2
        JOIN public.store_visual_signatures svs
          ON ct2.id::text = svs.metadata->>'credit_tx_id'
        JOIN (
          SELECT DISTINCT ge_v.visual_signature_id, ge_v.operation_run_id
          FROM public.generation_events ge_v
          WHERE ge_v.visual_signature_id IS NOT NULL
            AND ge_v.operation_run_id IS NOT NULL
        ) vr ON vr.visual_signature_id = svs.id
        WHERE ct2.type = 'deduction'
      ) de_all
      GROUP BY de_all.operation_run_id
    ) de
      ON de.operation_run_id = r.operation_run_id
    LEFT JOIN (
      SELECT
        a.target_id AS store_id,
        COUNT(*) AS grant_count
      FROM public.admin_audit_log a
      WHERE a.action = 'credit_grant'
        AND a.metadata->>'grant_type' = 'admin_grant'
      GROUP BY a.target_id
    ) sag
      ON sag.store_id = r.store_id
    WHERE (p_status IS NULL OR r.delivery_status = p_status)
  ),
  summary AS (
    SELECT
      SUM(fr.custo_usd_total) AS custo_usd_total,
      SUM(fr.creditos_debitados) AS creditos_debitados,
      SUM(fr.duracao_total_ms) AS duracao_total_ms,
      AVG(fr.duracao_total_ms) AS tempo_medio_ms,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY fr.duracao_total_ms) AS p95_ms,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE fr.delivery_status = 'failed') AS erros,
      COUNT(*) FILTER (WHERE fr.delivery_status = 'success') AS sucessos
    FROM filtered_runs fr
  )
  SELECT jsonb_build_object(
    'runs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'operation_run_id', sub.operation_run_id,
        'operation_run_type', sub.operation_run_type,
        'store_id', sub.store_id,
        'campaign_id', sub.campaign_id,
        'visual_signature_id', sub.visual_signature_id,
        'created_at', sub.created_at,
        'delivery_status', sub.delivery_status,
        'custo_usd_total', sub.custo_usd_total,
        'creditos_debitados', sub.creditos_debitados,
        'duracao_total_ms', sub.duracao_total_ms,
        'chamadas', sub.chamadas,
        'chamadas_success', sub.chamadas_success,
        'regeneracoes', sub.regeneracoes,
        'provider', sub.provider,
        'model', sub.model,
        'cost_source', sub.cost_source,
        'store_is_test', sub.is_test_flag,
        'deduction_purchased_amount', sub.deduction_purchased_amount,
        'deduction_bonus_amount', sub.deduction_bonus_amount,
        'admin_grant_evidence', sub.admin_grant_evidence,
        'cost_sources', COALESCE(sub.cost_sources, '{}'::text[]),
        'cost_estimation_notes', COALESCE(sub.cost_estimation_notes, '{}'::text[]),
        'has_provider_reported', COALESCE(sub.has_provider_reported, false),
        'has_provisional_image_estimate', COALESCE(sub.has_provisional_image_estimate, false),
        'has_partial_estimate', COALESCE(sub.has_partial_estimate, false),
        'has_not_available', COALESCE(sub.has_not_available, false),
        'has_estimated', COALESCE(sub.has_estimated, false)
      ) ORDER BY sub.created_at DESC)
      FROM (
        SELECT fr.*
        FROM filtered_runs fr
        ORDER BY fr.created_at DESC
        LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
      ) sub
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'custo_usd_total', (SELECT s.custo_usd_total FROM summary s),
      'creditos_debitados', (SELECT s.creditos_debitados FROM summary s),
      'duracao_total_ms', (SELECT s.duracao_total_ms FROM summary s),
      'tempo_medio_ms', (SELECT s.tempo_medio_ms FROM summary s),
      'p95_ms', (SELECT s.p95_ms FROM summary s),
      'total', (SELECT s.total FROM summary s),
      'erros', (SELECT s.erros FROM summary s),
      'sucessos', (SELECT s.sucessos FROM summary s)
    ),
    'page', v_page,
    'total', (SELECT s.total FROM summary s)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_get_ai_operation_runs IS
'RPC definer — lista entregas (operation_run_id) com filtros, paginação e summary sobre o conjunto filtrado (antes da página). Expõe evidências brutas de segmento (D9) e insumos de badge (D5); classificação é do service. Janela máx 365 dias. Acesso exclusivo service_role.';

REVOKE EXECUTE ON FUNCTION public.admin_get_ai_operation_runs(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_operation_runs(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER)
  TO service_role;

-- =============================================================================
-- Reversão (ordem reversa)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.admin_get_ai_operation_runs(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_get_ai_operation_runs(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER);
