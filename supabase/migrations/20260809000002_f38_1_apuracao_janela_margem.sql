-- F38.1 AJUSTES — reconciliação com janela temporal + margem por credit_unit_usd_value
-- =============================================================================
-- Correções pós-UAT (08-09-2026):
--
-- (B) A reconciliação NÃO respeitava a janela temporal de filtered_ge: runs fora
--     de p_hours apareciam em `reconciliation` mesmo sem estarem em
--     `by_operation_run`. Agora a CTE `reconciliation` do RPC só inclui runs que
--     possuem eventos na janela (mesmo conjunto de operation_run_id de
--     filtered_ge), a menos que p_operation_run_id seja fornecido explicitamente
--     (aí o run aparece mesmo fora da janela — filtro explícito vence).
--
-- (C) margem_estimada NÃO assume mais 1 crédito = USD 1:
--     - A view admin_cost_vs_credits expõe apenas dados brutos
--       (creditos_debitados, custo_usd_total) — receita/margem = NULL.
--     - O RPC admin_get_ai_costs recebe p_credit_unit_usd_value (default NULL):
--       NULL  → receita_estimada_usd e margem_estimada = NULL;
--       setado → receita_estimada_usd = creditos_debitados * p_credit_unit_usd_value,
--                margem_estimada = receita_estimada_usd - custo_usd_total.
--     - Config server-side (env), default NULL. Escopo mínimo; versável via migration.
-- =============================================================================

-- 1. View admin_cost_vs_credits — dados brutos, SEM assunção de unidade de crédito
--    A ordem de colunas muda (margem_estimada → receita_estimada_usd/margem_estimada)
--    e CREATE OR REPLACE VIEW não renomeia colunas (42P16) — então DROP + CREATE.
--    DROP FUNCTION primeiro para a view não ter dependentes.
DROP FUNCTION IF EXISTS public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER);
DROP VIEW IF EXISTS public.admin_cost_vs_credits;

CREATE VIEW public.admin_cost_vs_credits AS
WITH call_level AS (
  SELECT
    ge.operation_run_id,
    ge.store_id,
    ge.user_id,
    ge.campaign_id,
    ge.visual_signature_id,
    ge.generation_type,
    ge.attempt_number,
    COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd) AS accounting_cost_usd
  FROM public.generation_events ge
  WHERE ge.operation_run_id IS NOT NULL
    AND ge.generation_type NOT IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo')
),
stage_costs AS (
  SELECT
    cl.operation_run_id,
    cl.generation_type,
    SUM(cl.accounting_cost_usd) AS stage_cost_usd
  FROM call_level cl
  GROUP BY cl.operation_run_id, cl.generation_type
),
top_stages AS (
  SELECT
    sc.operation_run_id,
    array_agg(sc.generation_type ORDER BY sc.stage_cost_usd DESC) AS etapas_mais_caras
  FROM stage_costs sc
  GROUP BY sc.operation_run_id
),
campaign_runs AS (
  SELECT
    cl.operation_run_id,
    cl.store_id,
    cl.user_id,
    cl.campaign_id,
    SUM(cl.accounting_cost_usd) AS custo_usd_total,
    MAX(cl.attempt_number) FILTER (
      WHERE cl.generation_type IN ('campaign_image','campaign_image_review')
    ) AS n_tentativas
  FROM call_level cl
  WHERE cl.campaign_id IS NOT NULL
  GROUP BY cl.operation_run_id, cl.store_id, cl.user_id, cl.campaign_id
),
campaign_credits AS (
  SELECT
    ct.campaign_id,
    SUM(ABS(ct.amount)) AS creditos_debitados
  FROM public.credit_transactions ct
  WHERE ct.type = 'deduction'
    AND ct.campaign_id IS NOT NULL
    AND ct.metadata->>'feature' = 'campaign_pipeline'
  GROUP BY ct.campaign_id
),
vs_runs AS (
  SELECT
    cl.operation_run_id,
    cl.store_id,
    cl.user_id,
    cl.visual_signature_id,
    SUM(cl.accounting_cost_usd) AS custo_usd_total,
    MAX(cl.attempt_number) FILTER (
      WHERE cl.generation_type IN ('visual_signature_image','visual_signature_validation')
    ) AS n_tentativas
  FROM call_level cl
  WHERE cl.visual_signature_id IS NOT NULL
  GROUP BY cl.operation_run_id, cl.store_id, cl.user_id, cl.visual_signature_id
),
vs_credits AS (
  SELECT
    svs.id AS visual_signature_id,
    SUM(ABS(ct.amount)) AS creditos_debitados
  FROM public.store_visual_signatures svs
  JOIN public.credit_transactions ct
    ON ct.id::text = svs.metadata->>'credit_tx_id'
  WHERE ct.type = 'deduction'
  GROUP BY svs.id
)
SELECT
  cr.operation_run_id,
  'campaign' AS domain,
  cr.store_id,
  cr.user_id,
  cr.campaign_id,
  NULL::uuid AS visual_signature_id,
  cr.custo_usd_total,
  COALESCE(cc.creditos_debitados, 0) AS creditos_debitados,
  -- F38.1 (C): receita/margem calculadas no RPC com p_credit_unit_usd_value —
  -- a view não assume mais 1 crédito = USD 1.
  NULL::numeric AS receita_estimada_usd,
  NULL::numeric AS margem_estimada,
  ts.etapas_mais_caras,
  GREATEST(COALESCE(cr.n_tentativas, 0) - 1, 0) AS regeneracoes
FROM campaign_runs cr
LEFT JOIN campaign_credits cc ON cc.campaign_id = cr.campaign_id
LEFT JOIN top_stages ts ON ts.operation_run_id = cr.operation_run_id

UNION ALL

SELECT
  vr.operation_run_id,
  'visual_signature' AS domain,
  vr.store_id,
  vr.user_id,
  NULL::uuid AS campaign_id,
  vr.visual_signature_id,
  vr.custo_usd_total,
  COALESCE(vc.creditos_debitados, 0) AS creditos_debitados,
  NULL::numeric AS receita_estimada_usd,
  NULL::numeric AS margem_estimada,
  ts.etapas_mais_caras,
  GREATEST(COALESCE(vr.n_tentativas, 0) - 1, 0) AS regeneracoes
FROM vs_runs vr
LEFT JOIN vs_credits vc ON vc.visual_signature_id = vr.visual_signature_id
LEFT JOIN top_stages ts ON ts.operation_run_id = vr.operation_run_id;

REVOKE ALL ON TABLE public.admin_cost_vs_credits FROM anon, authenticated;

-- 2. admin_get_ai_costs — janela temporal na reconciliação + margem por unidade
-- (assinatura cresce de 8 para 9 params; DROP já feito acima — sem overload)
CREATE OR REPLACE FUNCTION public.admin_get_ai_costs(
  p_operation_run_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_store_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_generation_type TEXT DEFAULT NULL,
  p_hours INTEGER DEFAULT 24,
  p_credit_unit_usd_value NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- Janela mínima de 1h (anti-DoS — T-38.1-06)
  IF p_hours IS NULL OR p_hours < 1 THEN
    RAISE EXCEPTION 'ai_costs_hours_min';
  END IF;

  v_cutoff := NOW() - (p_hours || ' hours')::INTERVAL;

  WITH filtered_ge AS (
    SELECT
      ge.operation_run_id,
      ge.operation_run_type,
      ge.store_id,
      ge.user_id,
      ge.campaign_id,
      ge.visual_signature_id,
      ge.provider,
      ge.model,
      ge.generation_type,
      ge.status,
      ge.duration_ms,
      ge.attempt_number,
      COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd) AS accounting_cost_usd
    FROM public.generation_events ge
    WHERE ge.created_at >= v_cutoff
      AND (p_operation_run_id IS NULL OR ge.operation_run_id = p_operation_run_id)
      AND (p_campaign_id IS NULL OR ge.campaign_id = p_campaign_id)
      AND (p_store_id IS NULL OR ge.store_id = p_store_id)
      AND (p_user_id IS NULL OR ge.user_id = p_user_id)
      AND (p_provider IS NULL OR ge.provider = p_provider)
      AND (p_model IS NULL OR ge.model = p_model)
      AND (p_generation_type IS NULL OR ge.generation_type = p_generation_type)
      AND ge.generation_type NOT IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo')
  ),
  by_operation_run AS (
    SELECT
      ge.operation_run_id,
      ge.operation_run_type,
      SUM(ge.accounting_cost_usd) AS custo_usd_total,
      COUNT(*) AS n_chamadas,
      COUNT(*) FILTER (WHERE ge.status = 'success') AS n_success,
      SUM(ge.duration_ms) AS duracao_total_ms,
      GREATEST(
        COALESCE(MAX(ge.attempt_number) FILTER (
          WHERE ge.generation_type IN (
            'campaign_image','campaign_image_review',
            'visual_signature_image','visual_signature_validation'
          )
        ), 0) - 1,
        0
      ) AS regeneracoes
    FROM filtered_ge ge
    WHERE ge.operation_run_id IS NOT NULL
    GROUP BY ge.operation_run_id, ge.operation_run_type
  ),
  by_store AS (
    SELECT
      ge.store_id,
      SUM(ge.accounting_cost_usd) AS custo_usd_total,
      COUNT(*) AS n_chamadas
    FROM filtered_ge ge
    WHERE ge.store_id IS NOT NULL
    GROUP BY ge.store_id
  ),
  by_provider_model AS (
    SELECT
      ge.provider,
      ge.model,
      SUM(ge.accounting_cost_usd) AS custo_usd_total,
      COUNT(*) AS n_chamadas,
      AVG(ge.duration_ms) AS duracao_media_ms
    FROM filtered_ge ge
    GROUP BY ge.provider, ge.model
  ),
  by_generation_type AS (
    SELECT
      ge.generation_type,
      SUM(ge.accounting_cost_usd) AS custo_usd_total,
      COUNT(*) AS n_chamadas
    FROM filtered_ge ge
    GROUP BY ge.generation_type
  ),
  reconciliation AS (
    SELECT
      vc.operation_run_id,
      vc.domain,
      vc.store_id,
      vc.campaign_id,
      vc.custo_usd_total,
      vc.creditos_debitados,
      -- F38.1 (C): receita/margem derivam de p_credit_unit_usd_value
      CASE
        WHEN p_credit_unit_usd_value IS NULL THEN NULL
        ELSE COALESCE(vc.creditos_debitados, 0) * p_credit_unit_usd_value
      END AS receita_estimada_usd,
      CASE
        WHEN p_credit_unit_usd_value IS NULL THEN NULL
        ELSE COALESCE(vc.creditos_debitados, 0) * p_credit_unit_usd_value - vc.custo_usd_total
      END AS margem_estimada,
      vc.etapas_mais_caras,
      vc.regeneracoes
    FROM public.admin_cost_vs_credits vc
    WHERE (p_operation_run_id IS NULL OR vc.operation_run_id = p_operation_run_id)
      AND (p_campaign_id IS NULL OR vc.campaign_id = p_campaign_id)
      AND (p_store_id IS NULL OR vc.store_id = p_store_id)
      -- F38.1 (B): reconciliação respeita a MESMA janela de filtered_ge —
      -- runs fora da janela só aparecem quando p_operation_run_id é explícito.
      AND (
        p_operation_run_id IS NOT NULL
        OR vc.operation_run_id IN (
          SELECT DISTINCT ge.operation_run_id
          FROM filtered_ge ge
          WHERE ge.operation_run_id IS NOT NULL
        )
      )
  )
  SELECT jsonb_build_object(
    'by_operation_run', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'operation_run_id', bo.operation_run_id,
        'operation_run_type', bo.operation_run_type,
        'custo_usd_total', bo.custo_usd_total,
        'chamadas', bo.n_chamadas,
        'chamadas_success', bo.n_success,
        'duracao_total_ms', bo.duracao_total_ms,
        'regeneracoes', bo.regeneracoes
      ))
      FROM by_operation_run bo
    ), '[]'::jsonb),
    'by_store', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'store_id', bs.store_id,
        'custo_usd_total', bs.custo_usd_total,
        'chamadas', bs.n_chamadas
      ))
      FROM by_store bs
    ), '[]'::jsonb),
    'by_provider_model', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'provider', bpm.provider,
        'model', bpm.model,
        'custo_usd_total', bpm.custo_usd_total,
        'chamadas', bpm.n_chamadas,
        'duracao_media_ms', bpm.duracao_media_ms
      ))
      FROM by_provider_model bpm
    ), '[]'::jsonb),
    'by_generation_type', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'generation_type', bgt.generation_type,
        'custo_usd_total', bgt.custo_usd_total,
        'chamadas', bgt.n_chamadas
      ))
      FROM by_generation_type bgt
    ), '[]'::jsonb),
    'reconciliation', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'operation_run_id', rc.operation_run_id,
        'domain', rc.domain,
        'custo_usd_total', rc.custo_usd_total,
        'creditos_debitados', rc.creditos_debitados,
        'receita_estimada_usd', rc.receita_estimada_usd,
        'margem_estimada', rc.margem_estimada,
        'credit_unit_usd_value', p_credit_unit_usd_value,
        'etapas_mais_caras', rc.etapas_mais_caras,
        'regeneracoes', rc.regeneracoes
      ))
      FROM reconciliation rc
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_get_ai_costs IS
'RPC definer — apuração filtrada de custo de IA por operation_run/store/provider+model/generation_type + reconciliação USD × créditos (view admin_cost_vs_credits). p_hours >= 1. p_credit_unit_usd_value (default NULL): NULL → margem/receita NULL; setado → receita = creditos_debitados * p_credit_unit_usd_value, margem = receita - custo. Reconciliação respeita a janela de filtered_ge (runs fora só com p_operation_run_id explícito). regeneracoes = tentativas de arte extras (campaign_image/campaign_image_review, visual_signature_image/visual_signature_validation) além da 1ª, nunca negativo. Acesso exclusivo service_role.';

REVOKE EXECUTE ON FUNCTION public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, NUMERIC)
  TO service_role;

-- =============================================================================
-- REVERT (ordem reversa)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, NUMERIC) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, NUMERIC);
-- DROP VIEW IF EXISTS public.admin_cost_vs_credits;
-- CREATE VIEW public.admin_cost_vs_credits AS (definição da 20260809000001);
-- CREATE OR REPLACE FUNCTION public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER) AS (definição da 20260809000001);
