-- F56.1 — Configuração global do par principal/fallback (modelo + qualidade)
-- Local-first: aplicar e validar apenas no Supabase local antes de qualquer push remoto.
-- Esta migration é ADITIVA e LOCAL-ONLY: NÃO deve haver `supabase db push` remoto
-- antes de aprovação humana explícita (proposal §Migração; tasks 9.5).
--
-- Escopo (D-01/D-04/D-11/D-12):
--   1. Tabela global de linha vigente `image_model_pair_config` (chave singleton),
--      separada de `ai_model_selection` (que não tem dimensão de qualidade).
--   2. RLS service_role only.
--   3. RPC administrativa auditada `admin_set_image_model_pair_config`
--      (SECURITY DEFINER, motivo obrigatório, idempotência por operation_id,
--      validação contra o catálogo elegível, auditoria na mesma transação).
--   4. Extensão dos CHECKs de auditoria preservando TODOS os valores anteriores.
--
-- Isolamento do legado (D-07): esta migration NÃO altera `ai_model_selection`
-- nem qualquer default do pipeline vigente.

-- =============================================================================
-- 1. Tabela global do par principal/fallback (linha vigente singleton)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.image_model_pair_config (
  scope             TEXT PRIMARY KEY DEFAULT 'new_flow',
  primary_model     TEXT NOT NULL,
  primary_quality   TEXT NOT NULL,
  fallback_model    TEXT NOT NULL,
  fallback_quality  TEXT NOT NULL,
  config_version_id UUID NOT NULL DEFAULT gen_random_uuid(),
  reason            TEXT,
  updated_by        UUID REFERENCES auth.users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_image_model_pair_config_scope CHECK (scope = 'new_flow'),
  CONSTRAINT chk_image_model_pair_config_primary_quality CHECK (primary_quality IN ('low', 'medium')),
  CONSTRAINT chk_image_model_pair_config_fallback_quality CHECK (fallback_quality IN ('low', 'medium'))
);

-- =============================================================================
-- 2. RLS service_role only
-- =============================================================================
ALTER TABLE public.image_model_pair_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage image model pair config" ON public.image_model_pair_config;
CREATE POLICY "Service role can manage image model pair config"
  ON public.image_model_pair_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.image_model_pair_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.image_model_pair_config TO service_role;

-- =============================================================================
-- 3. RPC administrativa auditada e idempotente
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_image_model_pair_config(
  p_actor_id UUID,
  p_primary_model TEXT,
  p_primary_quality TEXT,
  p_fallback_model TEXT,
  p_fallback_quality TEXT,
  p_reason TEXT,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing JSONB;
  v_config_version_id UUID;
  v_result JSONB;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_primary_model IS NULL OR btrim(p_primary_model) = '' THEN RAISE EXCEPTION 'missing_primary_model'; END IF;
  IF p_fallback_model IS NULL OR btrim(p_fallback_model) = '' THEN RAISE EXCEPTION 'missing_fallback_model'; END IF;
  IF p_primary_quality IS NULL OR p_primary_quality NOT IN ('low', 'medium')
     OR p_fallback_quality IS NULL OR p_fallback_quality NOT IN ('low', 'medium') THEN
    RAISE EXCEPTION 'invalid_quality';
  END IF;

  -- Idempotência por operation_id (mesma transação garante unicidade da ação)
  SELECT metadata INTO v_existing
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id AND action = 'image_model_pair_config_update';
  IF FOUND THEN
    RETURN COALESCE(v_existing, '{}'::jsonb) || jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- Validação contra o catálogo elegível (capacidade própria do novo fluxo)
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_model_catalog
    WHERE capability = 'campaign_product_image' AND provider = 'openai'
      AND model = p_primary_model AND protocol = 'images' AND status = 'active'
  ) THEN RAISE EXCEPTION 'model_not_in_catalog'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ai_model_catalog
    WHERE capability = 'campaign_product_image' AND provider = 'openai'
      AND model = p_fallback_model AND protocol = 'images' AND status = 'active'
  ) THEN RAISE EXCEPTION 'model_not_in_catalog'; END IF;

  -- Upsert singleton (renova a versão da configuração e o timestamp)
  INSERT INTO public.image_model_pair_config (
    scope, primary_model, primary_quality, fallback_model, fallback_quality,
    config_version_id, reason, updated_by, updated_at
  ) VALUES (
    'new_flow', btrim(p_primary_model), p_primary_quality, btrim(p_fallback_model), p_fallback_quality,
    gen_random_uuid(), btrim(p_reason), p_actor_id, now()
  )
  ON CONFLICT (scope) DO UPDATE SET
    primary_model = EXCLUDED.primary_model,
    primary_quality = EXCLUDED.primary_quality,
    fallback_model = EXCLUDED.fallback_model,
    fallback_quality = EXCLUDED.fallback_quality,
    config_version_id = gen_random_uuid(),
    reason = EXCLUDED.reason,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at
  RETURNING config_version_id INTO v_config_version_id;

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'scope', 'new_flow',
    'primary_model', btrim(p_primary_model),
    'primary_quality', p_primary_quality,
    'fallback_model', btrim(p_fallback_model),
    'fallback_quality', p_fallback_quality,
    'config_version_id', v_config_version_id,
    'reason', btrim(p_reason)
  );

  -- Auditoria na mesma transação
  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id, 'image_model_pair_config_update', 'image_model_pair_config',
    v_config_version_id, btrim(p_reason), p_operation_id, v_result
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_image_model_pair_config(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_image_model_pair_config(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

-- =============================================================================
-- 4. Auditoria F56.1 (preserva TODOS os valores já aceitos)
-- =============================================================================
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
  'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
  'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
  'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update',
  'ai_model_selection_update', 'ai_model_selection_reset', 'support_credit_request_update',
  'data_subject_request_received', 'data_subject_request_in_progress',
  'data_subject_request_completed', 'data_subject_request_cancelled',
  'data_subject_request_cancel_rejected',
  'image_model_pair_config_update'
));

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check CHECK (
  target_type IN ('store', 'user', 'campaign', 'access_request', 'feature_flag', 'ai_model_selection', 'support_credit_request', 'data_subject_request', 'image_model_pair_config')
);

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente se necessário)
-- =============================================================================
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check CHECK (
--   target_type IN ('store', 'user', 'campaign', 'access_request', 'feature_flag', 'ai_model_selection', 'support_credit_request', 'data_subject_request')
-- );
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
--   'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
--   'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
--   'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update',
--   'ai_model_selection_update', 'ai_model_selection_reset', 'support_credit_request_update',
--   'data_subject_request_received', 'data_subject_request_in_progress',
--   'data_subject_request_completed', 'data_subject_request_cancelled',
--   'data_subject_request_cancel_rejected'
-- ));
-- REVOKE EXECUTE ON FUNCTION public.admin_set_image_model_pair_config(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_set_image_model_pair_config(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);
-- DROP TABLE IF EXISTS public.image_model_pair_config;
