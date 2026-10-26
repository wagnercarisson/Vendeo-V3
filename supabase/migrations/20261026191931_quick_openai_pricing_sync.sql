-- =============================================================================
-- Quick 261026 — sincronização diária das tarifas OpenAI
-- Migration: 20261026191931_quick_openai_pricing_sync.sql
--
-- APLICAÇÃO PENDENTE DE AUTORIZAÇÃO — preparada para homolog e produção.
-- NÃO aplicar sem autorização explícita nesta ou em outra execução.
--
-- Escopo:
--   1. Dimensões explícitas de entrada/cache de imagem em ai_model_pricing.
--   2. Tabela backend-only de tentativas (running/success/failed).
--   3. RPCs atômicas de start/apply/fail da sincronização.
--   4. Preservação das novas dimensões no RPC manual existente.
--
-- NÃO altera dados de preço, não recalcula histórico, não cria usuário fictício.
-- =============================================================================

-- =============================================================================
-- 1. Dimensões explícitas de imagem (aditivo)
-- =============================================================================
ALTER TABLE public.ai_model_pricing
  ADD COLUMN IF NOT EXISTS image_input_token_usd_per_1m NUMERIC,
  ADD COLUMN IF NOT EXISTS image_cached_input_token_usd_per_1m NUMERIC;

COMMENT ON COLUMN public.ai_model_pricing.image_input_token_usd_per_1m IS
  'Preço por 1M de tokens de ENTRADA de imagem (distinto de entrada textual e de image_unit_usd).';
COMMENT ON COLUMN public.ai_model_pricing.image_cached_input_token_usd_per_1m IS
  'Preço por 1M de tokens de ENTRADA de imagem em cache.';
COMMENT ON COLUMN public.ai_model_pricing.image_token_usd_per_1m IS
  'Preço por 1M de tokens de SAÍDA de imagem (dimensão existente; não é entrada de imagem).';

-- CHECK existente: inclui as novas dimensões para linhas que só tenham preço
-- de imagem por token.
ALTER TABLE public.ai_model_pricing
  DROP CONSTRAINT IF EXISTS chk_ai_model_pricing_at_least_one_price;
ALTER TABLE public.ai_model_pricing
  ADD CONSTRAINT chk_ai_model_pricing_at_least_one_price CHECK (
    input_token_usd_per_1m IS NOT NULL
    OR output_token_usd_per_1m IS NOT NULL
    OR cached_input_token_usd_per_1m IS NOT NULL
    OR image_unit_usd IS NOT NULL
    OR image_token_usd_per_1m IS NOT NULL
    OR image_input_token_usd_per_1m IS NOT NULL
    OR image_cached_input_token_usd_per_1m IS NOT NULL
  );

ALTER TABLE public.ai_model_pricing
  DROP CONSTRAINT IF EXISTS chk_ai_model_pricing_image_input_nonnegative;
ALTER TABLE public.ai_model_pricing
  ADD CONSTRAINT chk_ai_model_pricing_image_input_nonnegative CHECK (
    (image_input_token_usd_per_1m IS NULL OR image_input_token_usd_per_1m >= 0)
    AND (image_cached_input_token_usd_per_1m IS NULL OR image_cached_input_token_usd_per_1m >= 0)
  );

-- =============================================================================
-- 2. Tentativas de sincronização (backend-only)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pricing_sync_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  failure_stage TEXT,
  failure_code TEXT,
  source_url TEXT NOT NULL,
  content_hash TEXT,
  etag TEXT,
  last_modified TEXT,
  models_checked INTEGER NOT NULL DEFAULT 0,
  prices_checked INTEGER NOT NULL DEFAULT 0,
  prices_changed INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT chk_pricing_sync_status CHECK (status IN ('running', 'success', 'failed')),
  CONSTRAINT chk_pricing_sync_running_finished CHECK (
    (status = 'running' AND finished_at IS NULL)
    OR (status <> 'running' AND finished_at IS NOT NULL)
  ),
  CONSTRAINT chk_pricing_sync_counts CHECK (
    models_checked >= 0 AND prices_checked >= 0 AND prices_changed >= 0
  ),
  CONSTRAINT chk_pricing_sync_failure_fields CHECK (
    (failure_stage IS NULL OR char_length(failure_stage) <= 64)
    AND (failure_code IS NULL OR char_length(failure_code) <= 96)
  )
);

COMMENT ON TABLE public.pricing_sync_attempts IS
  'Quick 261026 — tentativas da sincronização diária de tarifas OpenAI. Backend-only; histórico preservado.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_sync_attempts_running
  ON public.pricing_sync_attempts ((status))
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_pricing_sync_attempts_started_at
  ON public.pricing_sync_attempts (started_at DESC);

ALTER TABLE public.pricing_sync_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage pricing sync attempts"
  ON public.pricing_sync_attempts;
CREATE POLICY "Service role can manage pricing sync attempts"
  ON public.pricing_sync_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.pricing_sync_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pricing_sync_attempts TO service_role;

-- =============================================================================
-- 3. RPC manual existente — preserva as novas dimensões ao versionar
-- =============================================================================
-- Mesma assinatura e mesmas regras; apenas carrega image_input/image_cached da
-- linha anterior para a nova versão. Atualizações manuais NÃO simulam sucesso
-- da consulta automática (a tabela de tentativas é independente).
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
  p_source_note TEXT DEFAULT NULL,
  p_quality TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prev_id UUID;
  v_prev_image_input NUMERIC;
  v_prev_image_cached NUMERIC;
  v_new_id UUID;
  v_result JSONB;
BEGIN
  IF p_provider IS NULL OR p_provider = '' THEN
    RAISE EXCEPTION 'ai_model_price_reason_required';
  END IF;

  IF p_model IS NULL OR p_model = '' THEN
    RAISE EXCEPTION 'ai_model_price_reason_required';
  END IF;

  IF p_reason IS NULL OR p_reason = '' THEN
    RAISE EXCEPTION 'ai_model_price_reason_required';
  END IF;

  IF p_quality IS NOT NULL AND p_quality NOT IN ('low', 'medium') THEN
    RAISE EXCEPTION 'invalid_quality';
  END IF;

  IF p_input IS NULL AND p_output IS NULL AND p_cached IS NULL
     AND p_image_unit IS NULL AND p_image_token IS NULL THEN
    RAISE EXCEPTION 'ai_model_price_no_dimension';
  END IF;

  IF p_quality IS NULL THEN
    SELECT id, image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m
      INTO v_prev_id, v_prev_image_input, v_prev_image_cached
    FROM public.ai_model_pricing
    WHERE provider = p_provider
      AND model = p_model
      AND quality IS NULL
      AND effective_until IS NULL;

    IF FOUND THEN
      UPDATE public.ai_model_pricing
      SET effective_until = now()
      WHERE provider = p_provider
        AND model = p_model
        AND quality IS NULL
        AND effective_until IS NULL;
    END IF;
  ELSE
    SELECT id, image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m
      INTO v_prev_id, v_prev_image_input, v_prev_image_cached
    FROM public.ai_model_pricing
    WHERE provider = p_provider
      AND model = p_model
      AND quality = p_quality
      AND effective_until IS NULL;

    IF FOUND THEN
      UPDATE public.ai_model_pricing
      SET effective_until = now()
      WHERE provider = p_provider
        AND model = p_model
        AND quality = p_quality
        AND effective_until IS NULL;
    END IF;
  END IF;

  INSERT INTO public.ai_model_pricing (
    provider, model, quality,
    input_token_usd_per_1m, output_token_usd_per_1m,
    cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m,
    image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m,
    effective_from, effective_until, source_url, source_note, updated_by
  ) VALUES (
    p_provider, p_model, p_quality,
    p_input, p_output, p_cached, p_image_unit, p_image_token,
    v_prev_image_input, v_prev_image_cached,
    now(), NULL, p_source_url, p_source_note, p_actor_id
  )
  RETURNING id INTO v_new_id;

  SELECT jsonb_build_object(
    'id', v_new_id,
    'provider', p_provider,
    'model', p_model,
    'quality', p_quality,
    'effective_from', now(),
    'previous_id', v_prev_id
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 4. Start da tentativa (uma running por vez; stale > 15min vira failed)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.pricing_sync_start(
  p_source_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_source_url IS NULL
     OR p_source_url NOT LIKE 'https://developers.openai.com/%' THEN
    RAISE EXCEPTION 'pricing_sync_invalid_source';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('openai_pricing_sync_start'));

  -- Recupera execução interrompida (processo morto/timeout) sem apagar histórico.
  UPDATE public.pricing_sync_attempts
  SET status = 'failed',
      finished_at = now(),
      failure_stage = 'start',
      failure_code = 'interrupted'
  WHERE status = 'running'
    AND started_at < now() - interval '15 minutes';

  IF EXISTS (SELECT 1 FROM public.pricing_sync_attempts WHERE status = 'running') THEN
    RETURN jsonb_build_object('started', false, 'reason', 'already_running');
  END IF;

  INSERT INTO public.pricing_sync_attempts (status, source_url)
  VALUES ('running', p_source_url)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('started', true, 'attempt_id', v_id);
END;
$$;

-- =============================================================================
-- 5. Apply atômico (versiona somente linhas alteradas + marca sucesso)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.pricing_sync_apply(
  p_attempt_id UUID,
  p_source_url TEXT,
  p_content_hash TEXT,
  p_etag TEXT,
  p_last_modified TEXT,
  p_models_checked INTEGER,
  p_prices JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
  v_item JSONB;
  v_provider TEXT;
  v_model TEXT;
  v_quality TEXT;
  v_text_input NUMERIC;
  v_text_output NUMERIC;
  v_text_cached NUMERIC;
  v_image_input NUMERIC;
  v_image_cached NUMERIC;
  v_image_output NUMERIC;
  v_cur RECORD;
  v_new_id UUID;
  v_checked INTEGER := 0;
  v_changed INTEGER := 0;
  v_updated INTEGER := 0;
BEGIN
  IF p_attempt_id IS NULL
     OR p_source_url IS NULL
     OR p_source_url NOT LIKE 'https://developers.openai.com/%'
     OR p_prices IS NULL
     OR jsonb_typeof(p_prices) <> 'array' THEN
    RAISE EXCEPTION 'pricing_sync_invalid_payload';
  END IF;

  IF p_models_checked IS NULL OR p_models_checked < 0 THEN
    RAISE EXCEPTION 'pricing_sync_invalid_payload';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('openai_pricing_sync_apply'));

  SELECT status INTO v_status
  FROM public.pricing_sync_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND OR v_status <> 'running' THEN
    RAISE EXCEPTION 'pricing_sync_attempt_not_running';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_prices) LOOP
    v_provider := NULLIF(v_item ->> 'provider', '');
    v_model := NULLIF(v_item ->> 'model', '');
    v_quality := NULLIF(v_item ->> 'quality', '');
    v_text_input := NULLIF(v_item ->> 'inputTokenUsdPer1M', '')::numeric;
    v_text_output := NULLIF(v_item ->> 'outputTokenUsdPer1M', '')::numeric;
    v_text_cached := NULLIF(v_item ->> 'cachedInputTokenUsdPer1M', '')::numeric;
    v_image_input := NULLIF(v_item ->> 'imageInputTokenUsdPer1M', '')::numeric;
    v_image_cached := NULLIF(v_item ->> 'imageCachedInputTokenUsdPer1M', '')::numeric;
    v_image_output := NULLIF(v_item ->> 'imageTokenUsdPer1M', '')::numeric;

    IF v_provider IS DISTINCT FROM 'openai' OR v_model IS NULL THEN
      RAISE EXCEPTION 'pricing_sync_invalid_row';
    END IF;
    IF v_quality IS NOT NULL AND v_quality NOT IN ('low', 'medium') THEN
      RAISE EXCEPTION 'pricing_sync_invalid_quality';
    END IF;
    IF v_text_input IS NULL AND v_text_output IS NULL AND v_text_cached IS NULL
       AND v_image_input IS NULL AND v_image_cached IS NULL AND v_image_output IS NULL THEN
      RAISE EXCEPTION 'pricing_sync_no_dimension';
    END IF;
    IF (v_text_input IS NOT NULL AND v_text_input < 0)
       OR (v_text_output IS NOT NULL AND v_text_output < 0)
       OR (v_text_cached IS NOT NULL AND v_text_cached < 0)
       OR (v_image_input IS NOT NULL AND v_image_input < 0)
       OR (v_image_cached IS NOT NULL AND v_image_cached < 0)
       OR (v_image_output IS NOT NULL AND v_image_output < 0) THEN
      RAISE EXCEPTION 'pricing_sync_invalid_price';
    END IF;

    IF v_quality IS NULL THEN
      SELECT * INTO v_cur
      FROM public.ai_model_pricing
      WHERE provider = v_provider
        AND model = v_model
        AND quality IS NULL
        AND effective_until IS NULL
      FOR UPDATE;
    ELSE
      SELECT * INTO v_cur
      FROM public.ai_model_pricing
      WHERE provider = v_provider
        AND model = v_model
        AND quality = v_quality
        AND effective_until IS NULL
      FOR UPDATE;
    END IF;

    IF FOUND THEN
      IF v_cur.input_token_usd_per_1m IS NOT DISTINCT FROM v_text_input
         AND v_cur.output_token_usd_per_1m IS NOT DISTINCT FROM v_text_output
         AND v_cur.cached_input_token_usd_per_1m IS NOT DISTINCT FROM v_text_cached
         AND v_cur.image_token_usd_per_1m IS NOT DISTINCT FROM v_image_output
         AND v_cur.image_input_token_usd_per_1m IS NOT DISTINCT FROM v_image_input
         AND v_cur.image_cached_input_token_usd_per_1m IS NOT DISTINCT FROM v_image_cached THEN
        v_checked := v_checked + 1;
        CONTINUE;
      END IF;

      UPDATE public.ai_model_pricing
      SET effective_until = now()
      WHERE id = v_cur.id;

      INSERT INTO public.ai_model_pricing (
        provider, model, quality,
        input_token_usd_per_1m, output_token_usd_per_1m,
        cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m,
        image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m,
        effective_from, effective_until, source_url, source_note, updated_by
      ) VALUES (
        v_provider, v_model, v_quality,
        v_text_input, v_text_output, v_text_cached,
        v_cur.image_unit_usd, v_image_output,
        v_image_input, v_image_cached,
        now(), NULL, p_source_url,
        left('OpenAI pricing sync (Standard); content_hash=' || coalesce(p_content_hash, ''), 500),
        NULL
      )
      RETURNING id INTO v_new_id;
    ELSE
      INSERT INTO public.ai_model_pricing (
        provider, model, quality,
        input_token_usd_per_1m, output_token_usd_per_1m,
        cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m,
        image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m,
        effective_from, effective_until, source_url, source_note, updated_by
      ) VALUES (
        v_provider, v_model, v_quality,
        v_text_input, v_text_output, v_text_cached,
        NULL, v_image_output,
        v_image_input, v_image_cached,
        now(), NULL, p_source_url,
        left('OpenAI pricing sync (Standard); content_hash=' || coalesce(p_content_hash, ''), 500),
        NULL
      )
      RETURNING id INTO v_new_id;
    END IF;

    v_changed := v_changed + 1;
    v_checked := v_checked + 1;
  END LOOP;

  UPDATE public.pricing_sync_attempts
  SET status = 'success',
      finished_at = now(),
      source_url = p_source_url,
      content_hash = p_content_hash,
      etag = p_etag,
      last_modified = p_last_modified,
      models_checked = p_models_checked,
      prices_checked = v_checked,
      prices_changed = v_changed,
      failure_stage = NULL,
      failure_code = NULL
  WHERE id = p_attempt_id
    AND status = 'running';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'pricing_sync_attempt_not_running';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'attempt_id', p_attempt_id,
    'models_checked', p_models_checked,
    'prices_checked', v_checked,
    'prices_changed', v_changed
  );
END;
$$;

-- =============================================================================
-- 6. Falha segura (nunca apaga histórico; nunca sobrescreve sucesso)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.pricing_sync_fail(
  p_attempt_id UUID,
  p_failure_stage TEXT,
  p_failure_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  IF p_attempt_id IS NULL
     OR p_failure_stage IS NULL
     OR btrim(p_failure_stage) = ''
     OR p_failure_code IS NULL
     OR btrim(p_failure_code) = '' THEN
    RAISE EXCEPTION 'pricing_sync_invalid_failure';
  END IF;

  UPDATE public.pricing_sync_attempts
  SET status = 'failed',
      finished_at = now(),
      failure_stage = left(p_failure_stage, 64),
      failure_code = left(p_failure_code, 96)
  WHERE id = p_attempt_id
    AND status = 'running';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('recorded', v_updated = 1);
END;
$$;

-- =============================================================================
-- 7. Grants (service_role only)
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.pricing_sync_start(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pricing_sync_start(TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pricing_sync_apply(
  UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pricing_sync_apply(
  UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pricing_sync_fail(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pricing_sync_fail(UUID, TEXT, TEXT) TO service_role;

-- =============================================================================
-- 8. Recuperação (forward-only; manual)
-- =============================================================================
-- REVERT manual (opcional; NÃO é critério automático de qualidade):
--   DROP FUNCTION IF EXISTS public.pricing_sync_fail(UUID, TEXT, TEXT);
--   DROP FUNCTION IF EXISTS public.pricing_sync_apply(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB);
--   DROP FUNCTION IF EXISTS public.pricing_sync_start(TEXT);
--   DROP TABLE IF EXISTS public.pricing_sync_attempts;
--   ALTER TABLE public.ai_model_pricing DROP CONSTRAINT IF EXISTS chk_ai_model_pricing_image_input_nonnegative;
--   ALTER TABLE public.ai_model_pricing DROP COLUMN IF EXISTS image_cached_input_token_usd_per_1m;
--   ALTER TABLE public.ai_model_pricing DROP COLUMN IF EXISTS image_input_token_usd_per_1m;
--   (restaurar chk_ai_model_pricing_at_least_one_price sem as duas novas colunas)
