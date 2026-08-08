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
