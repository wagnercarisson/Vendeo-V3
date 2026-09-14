-- Forward fix for the production RPC used by AiCostAdminService and pipeline
-- metrics. The F44.1 replacement projected economic fields but omitted
-- generation_events.created_at from filtered_ge while ordering by it later.
-- Preserve the public signature, grants, filters and response shape; only add
-- the missing projected column.

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
      ge.created_at,
      ge.provider,
      ge.model,
      ge.generation_type,
      ge.status,
      ge.duration_ms,
      ge.attempt_number,
      ge.usd_brl_rate_at_generation,
      ge.credit_value_brl_at_generation,
      ge.usd_brl_rate_source_at_generation,
      ge.credit_value_brl_source_at_generation,
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
      AND ge.generation_type NOT IN ('campaign_pipeline', 'visual_signature', 'brand_profile_without_logo', 'brand_profile_with_logo', 'theme_generation')
  ),
  by_operation_run AS (
    SELECT
      ge.operation_run_id,
      ge.operation_run_type,
      SUM(ge.accounting_cost_usd) AS custo_usd_total,
      COUNT(*) AS n_chamadas,
      COUNT(*) FILTER (WHERE ge.status = 'success') AS n_success,
      SUM(ge.duration_ms) AS duracao_total_ms,
      GREATEST(COALESCE(MAX(ge.attempt_number) FILTER (WHERE ge.generation_type IN ('campaign_image', 'campaign_image_review', 'visual_signature_image', 'visual_signature_validation')), 0) - 1, 0) AS regeneracoes,
      (array_agg(ge.usd_brl_rate_at_generation ORDER BY ge.created_at) FILTER (WHERE ge.usd_brl_rate_at_generation IS NOT NULL))[1] AS usd_brl_rate_at_generation,
      (array_agg(ge.credit_value_brl_at_generation ORDER BY ge.created_at) FILTER (WHERE ge.credit_value_brl_at_generation IS NOT NULL))[1] AS credit_value_brl_at_generation,
      (array_agg(ge.usd_brl_rate_source_at_generation ORDER BY ge.created_at) FILTER (WHERE ge.usd_brl_rate_at_generation IS NOT NULL))[1] AS usd_brl_rate_source_at_generation,
      (array_agg(ge.credit_value_brl_source_at_generation ORDER BY ge.created_at) FILTER (WHERE ge.credit_value_brl_at_generation IS NOT NULL))[1] AS credit_value_brl_source_at_generation
    FROM filtered_ge ge
    WHERE ge.operation_run_id IS NOT NULL
    GROUP BY ge.operation_run_id, ge.operation_run_type
  ),
  by_store AS (
    SELECT store_id, SUM(accounting_cost_usd) AS custo_usd_total, COUNT(*) AS n_chamadas
    FROM filtered_ge
    WHERE store_id IS NOT NULL
    GROUP BY store_id
  ),
  by_provider_model AS (
    SELECT provider, model, SUM(accounting_cost_usd) AS custo_usd_total, COUNT(*) AS n_chamadas, AVG(duration_ms) AS duracao_media_ms
    FROM filtered_ge
    GROUP BY provider, model
  ),
  by_generation_type AS (
    SELECT generation_type, SUM(accounting_cost_usd) AS custo_usd_total, COUNT(*) AS n_chamadas
    FROM filtered_ge
    GROUP BY generation_type
  ),
  reconciliation AS (
    SELECT
      vc.operation_run_id,
      vc.domain,
      vc.store_id,
      vc.campaign_id,
      vc.custo_usd_total,
      vc.creditos_debitados,
      CASE WHEN p_credit_unit_usd_value IS NULL THEN NULL ELSE COALESCE(vc.creditos_debitados, 0) * p_credit_unit_usd_value END AS receita_estimada_usd,
      CASE WHEN p_credit_unit_usd_value IS NULL THEN NULL ELSE COALESCE(vc.creditos_debitados, 0) * p_credit_unit_usd_value - vc.custo_usd_total END AS margem_estimada,
      vc.etapas_mais_caras,
      vc.regeneracoes,
      bo.usd_brl_rate_at_generation,
      bo.credit_value_brl_at_generation,
      bo.usd_brl_rate_source_at_generation,
      bo.credit_value_brl_source_at_generation
    FROM public.admin_cost_vs_credits vc
    LEFT JOIN by_operation_run bo USING (operation_run_id)
    WHERE (p_operation_run_id IS NULL OR vc.operation_run_id = p_operation_run_id)
      AND (p_campaign_id IS NULL OR vc.campaign_id = p_campaign_id)
      AND (p_store_id IS NULL OR vc.store_id = p_store_id)
      AND (p_operation_run_id IS NOT NULL OR vc.operation_run_id IN (SELECT DISTINCT operation_run_id FROM filtered_ge WHERE operation_run_id IS NOT NULL))
  )
  SELECT jsonb_build_object(
    'by_operation_run', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'operation_run_id', bo.operation_run_id,
      'operation_run_type', bo.operation_run_type,
      'custo_usd_total', bo.custo_usd_total,
      'chamadas', bo.n_chamadas,
      'chamadas_success', bo.n_success,
      'duracao_total_ms', bo.duracao_total_ms,
      'regeneracoes', bo.regeneracoes,
      'usd_brl_rate_at_generation', bo.usd_brl_rate_at_generation,
      'credit_value_brl_at_generation', bo.credit_value_brl_at_generation,
      'usd_brl_rate_source_at_generation', bo.usd_brl_rate_source_at_generation,
      'credit_value_brl_source_at_generation', bo.credit_value_brl_source_at_generation
    )) FROM by_operation_run bo), '[]'::jsonb),
    'by_store', COALESCE((SELECT jsonb_agg(jsonb_build_object('store_id', bs.store_id, 'custo_usd_total', bs.custo_usd_total, 'chamadas', bs.n_chamadas)) FROM by_store bs), '[]'::jsonb),
    'by_provider_model', COALESCE((SELECT jsonb_agg(jsonb_build_object('provider', bpm.provider, 'model', bpm.model, 'custo_usd_total', bpm.custo_usd_total, 'chamadas', bpm.n_chamadas, 'duracao_media_ms', bpm.duracao_media_ms)) FROM by_provider_model bpm), '[]'::jsonb),
    'by_generation_type', COALESCE((SELECT jsonb_agg(jsonb_build_object('generation_type', bgt.generation_type, 'custo_usd_total', bgt.custo_usd_total, 'chamadas', bgt.n_chamadas)) FROM by_generation_type bgt), '[]'::jsonb),
    'reconciliation', COALESCE((SELECT jsonb_agg(jsonb_build_object('operation_run_id', rc.operation_run_id, 'domain', rc.domain, 'custo_usd_total', rc.custo_usd_total, 'creditos_debitados', rc.creditos_debitados, 'receita_estimada_usd', rc.receita_estimada_usd, 'margem_estimada', rc.margem_estimada, 'credit_unit_usd_value', p_credit_unit_usd_value, 'etapas_mais_caras', rc.etapas_mais_caras, 'regeneracoes', rc.regeneracoes, 'usd_brl_rate_at_generation', rc.usd_brl_rate_at_generation, 'credit_value_brl_at_generation', rc.credit_value_brl_at_generation, 'usd_brl_rate_source_at_generation', rc.usd_brl_rate_source_at_generation, 'credit_value_brl_source_at_generation', rc.credit_value_brl_source_at_generation)) FROM reconciliation rc), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, NUMERIC) TO service_role;

-- REVERT: restore the previous definition from
-- 20260826000002_f44_1_restore_theme_economic_snapshots.sql.
