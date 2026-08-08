-- F38.1 — Apuração de Custos de IA por Entrega (trilha granular de custo)
-- =============================================================================
-- Migration única da F38.1: evolui o schema para apuração de custo de IA por
-- entrega (eventos call-level agregados por operation_run_id):
--   - generation_events: 9 colunas novas (D2) + CHECK cost_source (D4) +
--     CHECK generation_type expandido (D5) + 5 índices (D2)
--   - campaigns.operation_run_id + índice (D1/D2 — preparo reuso F37)
--   - ai_model_pricing: tabela versionada + seeds + RPC admin_set_ai_model_price (D8)
--   - Views de apuração/reconciliação + RPC admin_get_ai_costs (D10)
--
-- Regras:
--   - Anti-dupla-contagem (D1/D6): views somam APENAS eventos call-level;
--     delivery markers (campaign_pipeline, visual_signature, brand_profile_*)
--     não gravam custo — compat com admin_get_metrics (F28)
--   - Valor contábil por evento (D3): COALESCE(provider_reported_cost_usd, estimated_cost_usd)
--   - RLS default-deny mantido; ai_model_pricing service_role-only (D8);
--     views sem GRANT ao cliente — acesso via RPC definer (D10)
--   - RPCs definer com search_path travado (anti hijack — T-38.1-01)
--   - reserve_credit/credit_transactions (F24) e admin_get_metrics (F28) INALTERADOS
--
-- Blocos:
--   1. ALTER generation_events — 9 colunas novas (D2)
--   2. CHECK cost_source (D4) + substituição CHECK generation_type (D5)
--   3. Índices generation_events (5)
--   4. ALTER campaigns — operation_run_id + índice (D1/D2)
--   5. Tabela ai_model_pricing + índice parcial único + trigger + RLS (D8)
--   6. Seeds de preço (7 modelos, bootstrap)
--   7. RPC admin_set_ai_model_price (D8)
--   8. Views de apuração admin_ai_* (D10)
--   9. View de reconciliação admin_cost_vs_credits (D10)
--   10. RPC admin_get_ai_costs (D10)
--   11. Rollback (comentado)

-- =============================================================================
-- 1. ALTER generation_events — 9 colunas novas (D2)
-- =============================================================================
ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS operation_run_id UUID;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS operation_run_type TEXT;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS visual_signature_id UUID REFERENCES public.store_visual_signatures(id);

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS theme_id UUID;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS cached_input_tokens INTEGER;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS image_tokens INTEGER;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS provider_reported_cost_usd REAL;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS cost_source TEXT;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS pricing_version TEXT;

-- =============================================================================
-- 2. CHECKs — cost_source (D4) + generation_type expandido (D5)
-- =============================================================================
ALTER TABLE public.generation_events
ADD CONSTRAINT chk_generation_events_cost_source
CHECK (cost_source IN ('provider_reported','pricing_table','fallback_static','manual_unknown','not_available'));

-- Substituição do CHECK antigo (padrão 20260718000002_expand_generation_events.sql)
ALTER TABLE public.generation_events
DROP CONSTRAINT IF EXISTS chk_generation_events_type;

ALTER TABLE public.generation_events
ADD CONSTRAINT chk_generation_events_type
CHECK (generation_type IN (
  'campaign_pipeline','campaign_copy','campaign_input_validation',
  'campaign_image','campaign_image_review',
  'visual_signature','visual_signature_image','visual_signature_validation',
  'brand_profile_without_logo','brand_profile_with_logo',
  'brand_profile_vision','brand_profile_text'
));

-- =============================================================================
-- 3. Índices generation_events (D2)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_generation_events_operation_run_id
  ON public.generation_events (operation_run_id);

CREATE INDEX IF NOT EXISTS idx_generation_events_visual_signature_id
  ON public.generation_events (visual_signature_id);

CREATE INDEX IF NOT EXISTS idx_generation_events_operation_run_type
  ON public.generation_events (operation_run_type);

CREATE INDEX IF NOT EXISTS idx_generation_events_cost_source
  ON public.generation_events (cost_source);

CREATE INDEX IF NOT EXISTS idx_generation_events_provider_model
  ON public.generation_events (provider, model);

-- =============================================================================
-- 4. ALTER campaigns — operation_run_id + índice (D1/D2, preparo reuso F37)
-- =============================================================================
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS operation_run_id UUID;

CREATE INDEX IF NOT EXISTS idx_campaigns_operation_run_id
  ON public.campaigns (operation_run_id);

-- =============================================================================
-- 5. Tabela ai_model_pricing (D8) + índice parcial único + trigger + RLS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                      TEXT NOT NULL,
  model                         TEXT NOT NULL,
  input_token_usd_per_1m        NUMERIC,
  output_token_usd_per_1m       NUMERIC,
  cached_input_token_usd_per_1m NUMERIC,
  image_unit_usd                NUMERIC,
  image_token_usd_per_1m        NUMERIC,
  effective_from                TIMESTAMPTZ NOT NULL,
  effective_until               TIMESTAMPTZ,
  source_url                    TEXT,
  source_note                   TEXT,
  updated_by                    UUID REFERENCES auth.users(id),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_ai_model_pricing_at_least_one_price CHECK (
    input_token_usd_per_1m IS NOT NULL
    OR output_token_usd_per_1m IS NOT NULL
    OR cached_input_token_usd_per_1m IS NOT NULL
    OR image_unit_usd IS NOT NULL
    OR image_token_usd_per_1m IS NOT NULL
  )
);

-- Partial unique index (padrão F38 idx_credit_operation_cost_audit_idempotency):
-- no máx. 1 linha vigente por (provider, model), deixando o histórico livre.
-- NÃO usar constraint única full-table (provider, model) — quebraria o versionamento D8.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_model_pricing_vigente
  ON public.ai_model_pricing (provider, model)
  WHERE effective_until IS NULL;

-- Specific trigger function for this table (NOT a generic one per project convention)
CREATE OR REPLACE FUNCTION public.update_ai_model_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_model_pricing_updated_at
BEFORE UPDATE ON public.ai_model_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_model_pricing_updated_at();

-- RLS: service_role only — authenticated NÃO lê preços internos (D8)
ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_model_pricing FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_model_pricing TO service_role;

-- =============================================================================
-- 6. Seeds de preço (D8 — 7 modelos, bootstrap F38.1)
-- =============================================================================
INSERT INTO public.ai_model_pricing (
  provider, model,
  input_token_usd_per_1m, output_token_usd_per_1m,
  cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m,
  effective_from, effective_until, source_url, source_note, updated_by
) VALUES
  ('openai', 'gpt-4o', 2.50, 10.00, NULL, NULL, NULL,
   '2026-08-08T00:00:00Z', NULL, 'https://platform.openai.com/docs/pricing', 'bootstrap F38.1', NULL),
  ('openai', 'gpt-4o-mini', 0.15, 0.60, NULL, NULL, NULL,
   '2026-08-08T00:00:00Z', NULL, 'https://platform.openai.com/docs/pricing', 'bootstrap F38.1', NULL),
  ('openai', 'gpt-5.5', 5.00, 30.00, 0.50, NULL, NULL,
   '2026-08-08T00:00:00Z', NULL, 'https://platform.openai.com/docs/pricing', 'bootstrap F38.1', NULL),
  ('openai', 'gpt-image-2', NULL, NULL, NULL, 0.040, NULL,
   '2026-08-08T00:00:00Z', NULL, 'https://platform.openai.com/docs/pricing', 'bootstrap F38.1', NULL),
  ('openai', 'dall-e-3', NULL, NULL, NULL, 0.040, NULL,
   '2026-08-08T00:00:00Z', NULL, 'https://platform.openai.com/docs/pricing', 'bootstrap F38.1', NULL),
  ('gemini', 'gemini-2.0-flash', 0.10, 0.40, NULL, NULL, NULL,
   '2026-08-08T00:00:00Z', NULL, 'https://ai.google.dev/gemini-api/docs/pricing', 'bootstrap F38.1', NULL),
  ('gemini', 'gemini-3.1-flash-lite', 0.10, 0.40, NULL, NULL, NULL,
   '2026-08-08T00:00:00Z', NULL, 'https://ai.google.dev/gemini-api/docs/pricing', 'bootstrap F38.1', NULL)
ON CONFLICT (provider, model) WHERE effective_until IS NULL DO NOTHING;

-- =============================================================================
-- 7. RPC admin_set_ai_model_price (D8)
-- Transacional: fecha a linha vigente (effective_until = now()) e abre nova
-- (effective_from = now()) na mesma transação. p_reason obrigatório.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_ai_model_price(
  p_actor_id UUID,
  p_provider TEXT,
  p_model TEXT,
  p_input NUMERIC,
  p_output NUMERIC,
  p_reason TEXT,
  p_cached NUMERIC DEFAULT NULL,
  p_image_unit NUMERIC DEFAULT NULL,
  p_image_token NUMERIC DEFAULT NULL,
  p_source_url TEXT DEFAULT NULL,
  p_source_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prev_id UUID;
  v_new_id UUID;
  v_result JSONB;
BEGIN
  -- Validação: provider/model/reason obrigatórios (rastreabilidade — D8)
  IF p_provider IS NULL OR p_provider = '' THEN
    RAISE EXCEPTION 'ai_model_price_reason_required';
  END IF;

  IF p_model IS NULL OR p_model = '' THEN
    RAISE EXCEPTION 'ai_model_price_reason_required';
  END IF;

  IF p_reason IS NULL OR p_reason = '' THEN
    RAISE EXCEPTION 'ai_model_price_reason_required';
  END IF;

  -- Validação: ao menos uma dimensão de preço (espelha CHECK at_least_one_price)
  IF p_input IS NULL AND p_output IS NULL AND p_cached IS NULL
     AND p_image_unit IS NULL AND p_image_token IS NULL THEN
    RAISE EXCEPTION 'ai_model_price_no_dimension';
  END IF;

  -- Passo 1: captura e fecha a linha vigente (provider, model) na mesma transação
  SELECT id INTO v_prev_id
  FROM public.ai_model_pricing
  WHERE provider = p_provider
    AND model = p_model
    AND effective_until IS NULL;

  IF FOUND THEN
    UPDATE public.ai_model_pricing
    SET effective_until = now()
    WHERE provider = p_provider
      AND model = p_model
      AND effective_until IS NULL;
  END IF;

  -- Passo 2: abre a nova linha vigente (versionamento D8)
  INSERT INTO public.ai_model_pricing (
    provider, model,
    input_token_usd_per_1m, output_token_usd_per_1m,
    cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m,
    effective_from, effective_until, source_url, source_note, updated_by
  ) VALUES (
    p_provider, p_model,
    p_input, p_output, p_cached, p_image_unit, p_image_token,
    now(), NULL, p_source_url, p_source_note, p_actor_id
  )
  RETURNING id INTO v_new_id;

  SELECT jsonb_build_object(
    'id', v_new_id,
    'provider', p_provider,
    'model', p_model,
    'effective_from', now(),
    'previous_id', v_prev_id
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_set_ai_model_price IS
'RPC definer — versiona preço de IA: fecha a linha vigente (effective_until=now()) e abre nova (effective_from=now()) na mesma transação. p_reason obrigatório. Acesso exclusivo service_role.';

REVOKE EXECUTE ON FUNCTION public.admin_set_ai_model_price(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ai_model_price(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT)
  TO service_role;

-- =============================================================================
-- 8. Views de apuração admin_ai_* (D10)
-- =============================================================================
-- NO ANALOG #1: primeiro CREATE VIEW do repositório. SELECT no estilo CTE/
-- COUNT FILTER/jsonb_build_object do admin_get_metrics (F28), mas como VIEW.
--
-- Regras comuns:
--   - Valor contábil por evento (D3): COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd)
--   - Anti-dupla-contagem (D1/D6): filtram APENAS eventos call-level — delivery
--     markers (campaign_pipeline, visual_signature, brand_profile_*) excluídos

-- 8.1 admin_ai_operation_costs — custo total, duração, nº chamadas, nº tentativas
-- e status da entrega por operation_run_id (status vem do delivery marker do run)
CREATE OR REPLACE VIEW public.admin_ai_operation_costs AS
SELECT
  ge.operation_run_id,
  ge.operation_run_type,
  ge.store_id,
  ge.campaign_id,
  ge.visual_signature_id,
  SUM(COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd)) AS custo_usd_total,
  SUM(ge.duration_ms) AS duracao_total_ms,
  COUNT(*) AS n_chamadas,
  MAX(ge.attempt_number) AS n_tentativas,
  (SELECT delivery.status
   FROM public.generation_events delivery
   WHERE delivery.operation_run_id = ge.operation_run_id
     AND delivery.generation_type IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo')
   ORDER BY delivery.created_at DESC
   LIMIT 1) AS delivery_status
FROM public.generation_events ge
WHERE ge.operation_run_id IS NOT NULL
  AND ge.generation_type NOT IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo')
GROUP BY ge.operation_run_id, ge.operation_run_type, ge.store_id, ge.campaign_id, ge.visual_signature_id;

-- 8.2 admin_campaign_delivery_costs — custo da campanha por etapa (generation_type)
CREATE OR REPLACE VIEW public.admin_campaign_delivery_costs AS
SELECT
  ge.campaign_id,
  ge.generation_type,
  SUM(COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd)) AS custo_usd_total,
  COUNT(*) AS n_chamadas,
  MAX(ge.attempt_number) AS n_tentativas
FROM public.generation_events ge
WHERE ge.campaign_id IS NOT NULL
  AND ge.generation_type NOT IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo')
GROUP BY ge.campaign_id, ge.generation_type;

-- 8.3 admin_ai_cost_by_provider_model — gargalos por modelo/provedor
CREATE OR REPLACE VIEW public.admin_ai_cost_by_provider_model AS
SELECT
  ge.provider,
  ge.model,
  SUM(COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd)) AS custo_usd_total,
  COUNT(*) AS n_chamadas,
  AVG(ge.duration_ms) AS duracao_media_ms
FROM public.generation_events ge
WHERE ge.generation_type NOT IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo')
GROUP BY ge.provider, ge.model;

-- 8.4 admin_ai_cost_by_stage — gargalos por etapa (copy vs review vs imagem)
CREATE OR REPLACE VIEW public.admin_ai_cost_by_stage AS
SELECT
  ge.generation_type,
  SUM(COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd)) AS custo_usd_total,
  COUNT(*) AS n_chamadas,
  AVG(ge.duration_ms) AS duracao_media_ms
FROM public.generation_events ge
WHERE ge.generation_type NOT IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo')
GROUP BY ge.generation_type;

-- 8.5 admin_ai_cost_by_store — custo por loja (apuração)
CREATE OR REPLACE VIEW public.admin_ai_cost_by_store AS
SELECT
  ge.store_id,
  SUM(COALESCE(ge.provider_reported_cost_usd, ge.estimated_cost_usd)) AS custo_usd_total,
  COUNT(*) AS n_chamadas,
  SUM(ge.duration_ms) AS duracao_total_ms
FROM public.generation_events ge
WHERE ge.generation_type NOT IN ('campaign_pipeline','visual_signature','brand_profile_without_logo','brand_profile_with_logo')
GROUP BY ge.store_id;

-- Views sem GRANT direto ao cliente (T-38.1-03) — acesso exclusivo via RPC definer
REVOKE ALL ON TABLE public.admin_ai_operation_costs FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_campaign_delivery_costs FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_ai_cost_by_provider_model FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_ai_cost_by_stage FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_ai_cost_by_store FROM anon, authenticated;

-- =============================================================================
-- 9. View de reconciliação admin_cost_vs_credits (D10)
-- =============================================================================
-- Ponte com a F38 (eixo créditos): custo USD apurado (call-level) × créditos
-- debitados × margem estimada, por entrega (operation_run_id).
--   - Por campanha: credit_transactions type='deduction' com campaign_id e
--     metadata->>'feature'='campaign_pipeline' (F25 pipeline reserva/debita)
--   - Por VS: store_visual_signatures.metadata aponta o id da deduction da
--     assinatura (F29.1.1) — join com credit_transactions pelo id
-- margem_estimada: formato ABSOLUTO em créditos (≈USD) — creditos_debitados − custo_usd_total
-- regeneracoes: MAX(attempt_number) − 1 (tentativas extras além da 1ª)
CREATE OR REPLACE VIEW public.admin_cost_vs_credits AS
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
    MAX(cl.attempt_number) AS n_tentativas
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
    MAX(cl.attempt_number) AS n_tentativas
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
  -- margem_estimada: créditos debitados − custo apurado (absoluto, créditos ≈ USD)
  COALESCE(cc.creditos_debitados, 0) - cr.custo_usd_total AS margem_estimada,
  ts.etapas_mais_caras,
  cr.n_tentativas - 1 AS regeneracoes
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
  COALESCE(vc.creditos_debitados, 0) - vr.custo_usd_total AS margem_estimada,
  ts.etapas_mais_caras,
  vr.n_tentativas - 1 AS regeneracoes
FROM vs_runs vr
LEFT JOIN vs_credits vc ON vc.visual_signature_id = vr.visual_signature_id
LEFT JOIN top_stages ts ON ts.operation_run_id = vr.operation_run_id;

REVOKE ALL ON TABLE public.admin_cost_vs_credits FROM anon, authenticated;

-- =============================================================================
-- 10. RPC admin_get_ai_costs (D10)
-- =============================================================================
-- Apuração filtrada de custo de IA, mesmo padrão do admin_get_metrics (F28):
-- CTE filtered_ge + COUNT FILTER + jsonb_build_object. Filtros p_* opcionais
-- (parâmetros vinculados — T-38.1-05), janela p_hours >= 1 (anti-DoS — T-38.1-06).
-- Reconciliação reutiliza a view admin_cost_vs_credits (evita duplicar lógica).
CREATE OR REPLACE FUNCTION public.admin_get_ai_costs(
  p_operation_run_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_store_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_generation_type TEXT DEFAULT NULL,
  p_hours INTEGER DEFAULT 24
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
      MAX(ge.attempt_number) - 1 AS regeneracoes
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
      vc.margem_estimada,
      vc.etapas_mais_caras,
      vc.regeneracoes
    FROM public.admin_cost_vs_credits vc
    WHERE (p_operation_run_id IS NULL OR vc.operation_run_id = p_operation_run_id)
      AND (p_campaign_id IS NULL OR vc.campaign_id = p_campaign_id)
      AND (p_store_id IS NULL OR vc.store_id = p_store_id)
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
        'margem_estimada', rc.margem_estimada,
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
'RPC definer — apuração filtrada de custo de IA por operation_run/store/provider+model/generation_type + reconciliação USD × créditos (view admin_cost_vs_credits). p_hours >= 1. Acesso exclusivo service_role.';

REVOKE EXECUTE ON FUNCTION public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER)
  TO service_role;

-- =============================================================================
-- REVERT (ordem reversa de criação)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_get_ai_costs(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER);
-- REVOKE EXECUTE ON FUNCTION public.admin_set_ai_model_price(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_set_ai_model_price(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT);
-- DROP VIEW IF EXISTS public.admin_ai_operation_costs;
-- DROP VIEW IF EXISTS public.admin_campaign_delivery_costs;
-- DROP VIEW IF EXISTS public.admin_ai_cost_by_provider_model;
-- DROP VIEW IF EXISTS public.admin_ai_cost_by_stage;
-- DROP VIEW IF EXISTS public.admin_ai_cost_by_store;
-- DROP VIEW IF EXISTS public.admin_cost_vs_credits;
-- DROP TRIGGER IF EXISTS trg_ai_model_pricing_updated_at ON public.ai_model_pricing;
-- DROP FUNCTION IF EXISTS public.update_ai_model_pricing_updated_at();
-- DROP TABLE IF EXISTS public.ai_model_pricing;  -- cascata do índice parcial uq_ai_model_pricing_vigente
-- DROP INDEX IF EXISTS uq_ai_model_pricing_vigente;
-- DROP INDEX IF EXISTS idx_campaigns_operation_run_id;
-- DROP INDEX IF EXISTS idx_generation_events_operation_run_id;
-- DROP INDEX IF EXISTS idx_generation_events_visual_signature_id;
-- DROP INDEX IF EXISTS idx_generation_events_operation_run_type;
-- DROP INDEX IF EXISTS idx_generation_events_cost_source;
-- DROP INDEX IF EXISTS idx_generation_events_provider_model;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS operation_run_id;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS operation_run_type;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS visual_signature_id;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS theme_id;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS cached_input_tokens;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS image_tokens;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS provider_reported_cost_usd;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS cost_source;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS pricing_version;
-- ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_generation_events_cost_source;
-- ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_generation_events_type;
-- ALTER TABLE public.generation_events
--   ADD CONSTRAINT chk_generation_events_type
--   CHECK (generation_type IN ('visual_signature','brand_profile_without_logo','brand_profile_with_logo','campaign_pipeline','campaign_copy','campaign_image'));
