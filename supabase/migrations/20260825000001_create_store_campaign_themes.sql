-- =============================================================================
-- F44.1 — Criar e usar Temas (D2/D15): entidade persistente + protocolo durável
-- de idempotência + economia + telemetria.
--
-- Blocos:
--   1. store_campaign_themes (draft|active|archived, JSONB, RLS owner-select)
--   2. theme_generation_requests (UNIQUE(store_id, generation_request_id))
--   3. RPCs transacionais finalize/fail/reconcile (SECURITY DEFINER)
--   4. Expansão do CHECK chk_generation_events_type (theme_direction/theme_generation)
--   5. Seeds (feature_flags.theme_generation_enabled + credit_operation_costs.theme_generation)
--
-- Regras (D2/D15):
--   - Sem coluna `metadata` em store_campaign_themes (todo dado de negócio em
--     essentials/direction); sem partial unique (loja pode ter VÁRIOS temas ativos).
--   - theme_generation_requests: status CHECK (processing|succeeded|failed),
--     theme_id FK ON DELETE SET NULL (descartar draft → 410 Gone), UNIQUE
--     (store_id, generation_request_id).
--   - RPCs SECURITY DEFINER + SET search_path='' ; fail/reconcile estornam
--     SOMENTE SE a dedução existir (guard IF _deduct_tx IS NOT NULL) — refund_credit
--     lança transacao_nao_encontrada quando p_tx_id não existe, o que reverteria
--     o UPDATE para failed.
-- =============================================================================

-- =============================================================================
-- 1. store_campaign_themes
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_campaign_themes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('draft','active','archived')),
  essentials   JSONB NOT NULL,
  direction    JSONB NOT NULL,
  generated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_campaign_themes_store_id
  ON public.store_campaign_themes (store_id);

CREATE INDEX IF NOT EXISTS idx_store_campaign_themes_store_status
  ON public.store_campaign_themes (store_id, status);

-- Trigger updated_at específico da tabela (convenção do repositório)
CREATE OR REPLACE FUNCTION public.update_store_campaign_themes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_store_campaign_themes_updated_at
BEFORE UPDATE ON public.store_campaign_themes
FOR EACH ROW
EXECUTE FUNCTION public.update_store_campaign_themes_updated_at();

-- RLS owner-select + grants (padrão child tables + service_role)
ALTER TABLE public.store_campaign_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_store_campaign_themes" ON public.store_campaign_themes
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())));

REVOKE ALL ON TABLE public.store_campaign_themes FROM anon;
REVOKE ALL ON TABLE public.store_campaign_themes FROM authenticated;
REVOKE ALL ON TABLE public.store_campaign_themes FROM service_role;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON TABLE public.store_campaign_themes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.store_campaign_themes TO service_role;

-- =============================================================================
-- 2. theme_generation_requests (idempotência durável)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.theme_generation_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  generation_request_id UUID NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('processing','succeeded','failed')),
  theme_id              UUID REFERENCES public.store_campaign_themes(id) ON DELETE SET NULL,
  operation_run_id      UUID,
  debit_transaction_id  UUID,
  processing_expires_at TIMESTAMPTZ,
  error_code            TEXT,
  http_status           INT,
  error_metadata        JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_theme_generation_requests UNIQUE (store_id, generation_request_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_generation_requests_store_id
  ON public.theme_generation_requests (store_id);

CREATE INDEX IF NOT EXISTS idx_theme_generation_requests_store_status
  ON public.theme_generation_requests (store_id, status);

CREATE OR REPLACE FUNCTION public.update_theme_generation_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_theme_generation_requests_updated_at
BEFORE UPDATE ON public.theme_generation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_theme_generation_requests_updated_at();

-- Tabela interna (protocolo de idempotência) — acesso exclusivo service_role.
ALTER TABLE public.theme_generation_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.theme_generation_requests FROM anon;
REVOKE ALL ON TABLE public.theme_generation_requests FROM authenticated;
REVOKE ALL ON TABLE public.theme_generation_requests FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.theme_generation_requests TO service_role;

-- =============================================================================
-- 3. RPCs transacionais finalize/fail/reconcile
-- =============================================================================

-- finalize_theme_generation: trava a request (FOR UPDATE), insere draft e marca
-- succeeded na MESMA transação. NOT FOUND -> exceção (rollback, sem draft órfão).
CREATE OR REPLACE FUNCTION public.finalize_theme_generation(
  p_store_id UUID,
  p_generation_request_id UUID,
  p_essentials JSONB,
  p_direction JSONB,
  p_run_id UUID,
  p_debit_tx_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id UUID;
  v_theme_id UUID;
BEGIN
  SELECT id INTO v_request_id
  FROM public.theme_generation_requests
  WHERE store_id = p_store_id
    AND generation_request_id = p_generation_request_id
    AND status = 'processing'
    AND processing_expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'theme_generation_request_not_processing';
  END IF;

  INSERT INTO public.store_campaign_themes (store_id, status, essentials, direction, generated_at)
  VALUES (p_store_id, 'draft', p_essentials, p_direction, now())
  RETURNING id INTO v_theme_id;

  UPDATE public.theme_generation_requests
  SET status = 'succeeded',
      theme_id = v_theme_id,
      operation_run_id = p_run_id,
      debit_transaction_id = p_debit_tx_id,
      updated_at = now()
  WHERE id = v_request_id;

  RETURN v_theme_id;
END;
$$;

-- fail_theme_generation: CAS WHERE status='processing'; SEMPRE marca failed;
-- estorna via public.refund_credit SOMENTE SE a dedução existir.
CREATE OR REPLACE FUNCTION public.fail_theme_generation(
  p_store_id UUID,
  p_generation_request_id UUID,
  p_error_code TEXT,
  p_http_status INT,
  p_error_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id UUID;
  v_deduct_tx_id UUID;
  v_refund_tx_id UUID;
  v_idempotency_key TEXT;
  v_refund_key TEXT;
BEGIN
  UPDATE public.theme_generation_requests
  SET status = 'failed',
      error_code = p_error_code,
      http_status = p_http_status,
      error_metadata = p_error_metadata,
      updated_at = now()
  WHERE store_id = p_store_id
    AND generation_request_id = p_generation_request_id
    AND status = 'processing'
  RETURNING id INTO v_request_id;

  -- Já resolvida (idempotência) — nada a fazer
  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('failed', false, 'already_resolved', true);
  END IF;

  v_idempotency_key := 'theme_generation:' || p_store_id::text || ':' || p_generation_request_id::text;
  v_refund_key := 'refund:theme_generation:' || p_store_id::text || ':' || p_generation_request_id::text;

  SELECT id INTO v_deduct_tx_id
  FROM public.credit_transactions
  WHERE store_id = p_store_id
    AND idempotency_key = v_idempotency_key
    AND type = 'deduction'
  LIMIT 1;

  -- Guard obrigatório: refund_credit lança transacao_nao_encontrada quando o
  -- p_tx_id não existe — reverteria o UPDATE acima. Estorna SÓ SE a dedução existir.
  IF v_deduct_tx_id IS NOT NULL THEN
    v_refund_tx_id := public.refund_credit(
      v_deduct_tx_id,
      'theme_generation_failed',
      v_refund_key,
      jsonb_build_object('generation_request_id', p_generation_request_id, 'error_code', p_error_code)
    );
  END IF;

  RETURN jsonb_build_object('failed', true, 'refund_tx_id', v_refund_tx_id);
END;
$$;

-- reconcile_expired_theme_request: oportunista no retry — CAS status='processing'
-- AND processing_expires_at <= now(); marca failed e estorna só se débito existir.
CREATE OR REPLACE FUNCTION public.reconcile_expired_theme_request(
  p_store_id UUID,
  p_generation_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id UUID;
  v_deduct_tx_id UUID;
  v_refund_tx_id UUID;
  v_idempotency_key TEXT;
  v_refund_key TEXT;
BEGIN
  UPDATE public.theme_generation_requests
  SET status = 'failed',
      error_code = 'processing_abandoned',
      http_status = 410,
      error_metadata = jsonb_build_object('reason', 'processing_expired'),
      updated_at = now()
  WHERE store_id = p_store_id
    AND generation_request_id = p_generation_request_id
    AND status = 'processing'
    AND processing_expires_at <= now()
  RETURNING id INTO v_request_id;

  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('reconciled', false);
  END IF;

  v_idempotency_key := 'theme_generation:' || p_store_id::text || ':' || p_generation_request_id::text;
  v_refund_key := 'refund:theme_generation:' || p_store_id::text || ':' || p_generation_request_id::text;

  SELECT id INTO v_deduct_tx_id
  FROM public.credit_transactions
  WHERE store_id = p_store_id
    AND idempotency_key = v_idempotency_key
    AND type = 'deduction'
  LIMIT 1;

  IF v_deduct_tx_id IS NOT NULL THEN
    v_refund_tx_id := public.refund_credit(
      v_deduct_tx_id,
      'theme_generation_processing_abandoned',
      v_refund_key,
      jsonb_build_object('generation_request_id', p_generation_request_id)
    );
  END IF;

  RETURN jsonb_build_object('reconciled', true, 'refund_tx_id', v_refund_tx_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_theme_generation(UUID, UUID, JSONB, JSONB, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_theme_generation(UUID, UUID, TEXT, INT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_expired_theme_request(UUID, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_theme_generation(UUID, UUID, JSONB, JSONB, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_theme_generation(UUID, UUID, TEXT, INT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_theme_request(UUID, UUID) TO service_role;

-- =============================================================================
-- 4. Expansão do CHECK chk_generation_events_type (theme_direction/theme_generation)
--    ÚNICA migration de CHECK da F44.1 (precedente F38.1 D5 / 20260718000002).
-- =============================================================================
ALTER TABLE public.generation_events
  DROP CONSTRAINT IF EXISTS chk_generation_events_type;

ALTER TABLE public.generation_events
  ADD CONSTRAINT chk_generation_events_type
  CHECK (generation_type IN (
    'campaign_pipeline','campaign_copy','campaign_input_validation',
    'campaign_image','campaign_image_review',
    'visual_signature','visual_signature_image','visual_signature_validation',
    'brand_profile_without_logo','brand_profile_with_logo',
    'brand_profile_vision','brand_profile_text',
    'theme_direction','theme_generation'
  ));

-- =============================================================================
-- 5. Seeds (idempotentes)
-- =============================================================================
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'theme_generation_enabled',
  true,
  'Quando ligada, permite a geracao de temas por IA (POST /themes/generate-preview). Flag administrativa minima — fallback de leitura false em falha (fail-closed).'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.credit_operation_costs (operation_key, cost_credits, enabled, updated_by)
VALUES ('theme_generation', 1, true, NULL)
ON CONFLICT (operation_key) DO NOTHING;

-- =============================================================================
-- REVERT (ordem reversa)
-- =============================================================================
-- DELETE FROM public.credit_operation_costs WHERE operation_key = 'theme_generation';
-- DELETE FROM public.feature_flags WHERE key = 'theme_generation_enabled';
-- ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_generation_events_type;
-- ALTER TABLE public.generation_events ADD CONSTRAINT chk_generation_events_type
--   CHECK (generation_type IN (
--     'campaign_pipeline','campaign_copy','campaign_input_validation',
--     'campaign_image','campaign_image_review',
--     'visual_signature','visual_signature_image','visual_signature_validation',
--     'brand_profile_without_logo','brand_profile_with_logo',
--     'brand_profile_vision','brand_profile_text'
--   ));
-- REVOKE EXECUTE ON FUNCTION public.reconcile_expired_theme_request(UUID, UUID) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.fail_theme_generation(UUID, UUID, TEXT, INT, JSONB) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.finalize_theme_generation(UUID, UUID, JSONB, JSONB, UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.reconcile_expired_theme_request(UUID, UUID);
-- DROP FUNCTION IF EXISTS public.fail_theme_generation(UUID, UUID, TEXT, INT, JSONB);
-- DROP FUNCTION IF EXISTS public.finalize_theme_generation(UUID, UUID, JSONB, JSONB, UUID, UUID);
-- REVOKE ALL ON TABLE public.theme_generation_requests FROM service_role;
-- DROP TRIGGER IF EXISTS trg_theme_generation_requests_updated_at ON public.theme_generation_requests;
-- DROP FUNCTION IF EXISTS public.update_theme_generation_requests_updated_at();
-- DROP TABLE IF EXISTS public.theme_generation_requests;
-- REVOKE SELECT ON TABLE public.store_campaign_themes FROM authenticated;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.store_campaign_themes FROM service_role;
-- DROP POLICY IF EXISTS "owner_select_store_campaign_themes" ON public.store_campaign_themes;
-- ALTER TABLE public.store_campaign_themes DISABLE ROW LEVEL SECURITY;
-- DROP TRIGGER IF EXISTS trg_store_campaign_themes_updated_at ON public.store_campaign_themes;
-- DROP FUNCTION IF EXISTS public.update_store_campaign_themes_updated_at();
-- DROP TABLE IF EXISTS public.store_campaign_themes;
