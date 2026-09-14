-- F47 — Catálogo e Seleção de Modelos Admin
-- Local-first: aplicar e validar no Supabase local antes de qualquer push remoto.
-- O catálogo é a allowlist persistida por capacidade; a seleção é a configuração
-- efetiva. A ausência de seleção continua significando default do registry.

-- =============================================================================
-- 1. Catálogo e seleção (server-only)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_model_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('text', 'vision', 'image')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('chat-completions', 'responses', 'images', 'gemini')),
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  source_note TEXT,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (capability, provider, model, protocol)
);

CREATE TABLE IF NOT EXISTS public.ai_model_selection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('chat-completions', 'responses', 'images', 'gemini')),
  fallback_provider TEXT,
  fallback_model TEXT,
  fallback_protocol TEXT CHECK (fallback_protocol IN ('chat-completions', 'responses', 'images', 'gemini')),
  reason TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_ai_model_selection_fallback_complete CHECK (
    (fallback_provider IS NULL AND fallback_model IS NULL AND fallback_protocol IS NULL)
    OR (fallback_provider IS NOT NULL AND fallback_model IS NOT NULL AND fallback_protocol IS NOT NULL)
  ),
  CONSTRAINT chk_ai_model_selection_fallback_capability CHECK (
    capability = 'campaign_copy'
    OR (fallback_provider IS NULL AND fallback_model IS NULL AND fallback_protocol IS NULL)
  ),
  CONSTRAINT chk_ai_model_selection_primary_distinct CHECK (
    fallback_provider IS NULL
    OR provider <> fallback_provider
    OR model <> fallback_model
  )
);

ALTER TABLE public.ai_model_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_selection ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage AI model catalog" ON public.ai_model_catalog;
CREATE POLICY "Service role can manage AI model catalog"
  ON public.ai_model_catalog FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage AI model selection" ON public.ai_model_selection;
CREATE POLICY "Service role can manage AI model selection"
  ON public.ai_model_selection FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.ai_model_catalog FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_model_selection FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_model_catalog TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_model_selection TO service_role;

-- =============================================================================
-- 2. Matriz inicial explícita: 11 primários + 1 fallback de campaign_copy
-- =============================================================================
INSERT INTO public.ai_model_catalog (
  capability, segment, provider, model, protocol, label, status, source_note, validated_at
) VALUES
  ('campaign_copy', 'text', 'openai', 'gpt-4o', 'chat-completions', 'GPT-4o', 'active', 'F46 registry; Copy Director text path', now()),
  ('campaign_copy', 'text', 'gemini', 'gemini-3.1-flash-lite', 'gemini', 'Gemini 3.1 Flash Lite', 'active', 'F46 registry; explicit fallback path', now()),
  ('campaign_correction_analysis', 'text', 'openai', 'gpt-4o', 'chat-completions', 'GPT-4o', 'active', 'F46 registry; correction analysis path', now()),
  ('brand_profile_text', 'text', 'openai', 'gpt-4o', 'chat-completions', 'GPT-4o', 'active', 'F46 registry; brand profile text path', now()),
  ('campaign_spec', 'text', 'openai', 'gpt-4o-mini', 'chat-completions', 'GPT-4o mini', 'active', 'F46 registry; legacy campaign-intelligence path', now()),
  ('campaign_input_validation', 'vision', 'openai', 'gpt-4o', 'chat-completions', 'GPT-4o', 'active', 'F46 registry; campaign input validation path', now()),
  ('campaign_image_review', 'vision', 'openai', 'gpt-4o', 'chat-completions', 'GPT-4o', 'active', 'F46 registry; image review path', now()),
  ('brand_profile_vision', 'vision', 'openai', 'gpt-4o', 'chat-completions', 'GPT-4o', 'active', 'F46 registry; brand profile vision path', now()),
  ('visual_signature_validation', 'vision', 'openai', 'gpt-4o-mini', 'responses', 'GPT-4o mini', 'active', 'F46 registry; visual signature validation path', now()),
  ('campaign_image', 'image', 'openai', 'gpt-5.5', 'responses', 'GPT-5.5', 'active', 'F46 registry; Responses image generation path', now()),
  ('campaign_image_edit', 'image', 'openai', 'gpt-image-2', 'images', 'GPT Image 2', 'active', 'F46 registry; images.edit fallback path', now()),
  ('visual_signature_image', 'image', 'openai', 'gpt-5.5', 'responses', 'GPT-5.5', 'active', 'F46 registry; visual signature image path', now())
ON CONFLICT (capability, provider, model, protocol) DO NOTHING;

-- =============================================================================
-- 3. RPCs auditadas e idempotentes
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_ai_model_selection(
  p_capability TEXT,
  p_provider TEXT,
  p_model TEXT,
  p_protocol TEXT,
  p_fallback_provider TEXT,
  p_fallback_model TEXT,
  p_fallback_protocol TEXT,
  p_reason TEXT,
  p_actor_id UUID,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_selection_id UUID;
  v_existing JSONB;
BEGIN
  IF p_capability IS NULL OR btrim(p_capability) = '' THEN RAISE EXCEPTION 'missing_capability'; END IF;
  IF p_provider IS NULL OR btrim(p_provider) = '' OR p_model IS NULL OR btrim(p_model) = '' OR p_protocol IS NULL OR btrim(p_protocol) = '' THEN RAISE EXCEPTION 'missing_primary'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  SELECT metadata INTO v_existing
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id AND action = 'ai_model_selection_update';
  IF FOUND THEN RETURN COALESCE(v_existing, '{}'::jsonb) || jsonb_build_object('success', true, 'idempotent', true); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ai_model_catalog
    WHERE capability = p_capability AND provider = p_provider AND model = p_model
      AND protocol = p_protocol AND status = 'active'
  ) THEN RAISE EXCEPTION 'model_not_in_catalog'; END IF;

  IF p_capability <> 'campaign_copy' AND (p_fallback_provider IS NOT NULL OR p_fallback_model IS NOT NULL OR p_fallback_protocol IS NOT NULL) THEN
    RAISE EXCEPTION 'fallback_not_supported';
  END IF;
  IF (p_fallback_provider IS NULL) <> (p_fallback_model IS NULL)
     OR (p_fallback_provider IS NULL) <> (p_fallback_protocol IS NULL) THEN
    RAISE EXCEPTION 'incomplete_fallback';
  END IF;
  IF p_fallback_provider IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ai_model_catalog
    WHERE capability = p_capability AND provider = p_fallback_provider AND model = p_fallback_model
      AND protocol = p_fallback_protocol AND status = 'active'
  ) THEN RAISE EXCEPTION 'fallback_model_not_in_catalog'; END IF;
  IF p_fallback_provider IS NOT NULL AND p_provider = p_fallback_provider AND p_model = p_fallback_model THEN
    RAISE EXCEPTION 'primary_equals_fallback';
  END IF;

  INSERT INTO public.ai_model_selection (
    capability, provider, model, protocol, fallback_provider, fallback_model,
    fallback_protocol, reason, updated_by, updated_at
  ) VALUES (
    p_capability, p_provider, p_model, p_protocol, p_fallback_provider, p_fallback_model,
    p_fallback_protocol, btrim(p_reason), p_actor_id, now()
  )
  ON CONFLICT (capability) DO UPDATE SET
    provider = EXCLUDED.provider, model = EXCLUDED.model, protocol = EXCLUDED.protocol,
    fallback_provider = EXCLUDED.fallback_provider, fallback_model = EXCLUDED.fallback_model,
    fallback_protocol = EXCLUDED.fallback_protocol, reason = EXCLUDED.reason,
    updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_selection_id;

  v_existing := jsonb_build_object(
    'success', true, 'id', v_selection_id, 'capability', p_capability,
    'provider', p_provider, 'model', p_model, 'protocol', p_protocol,
    'fallback_provider', p_fallback_provider, 'fallback_model', p_fallback_model,
    'fallback_protocol', p_fallback_protocol, 'reason', btrim(p_reason)
  );
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, operation_id, metadata)
  VALUES (p_actor_id, 'ai_model_selection_update', 'ai_model_selection', v_selection_id, btrim(p_reason), p_operation_id, v_existing);
  RETURN v_existing;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_ai_model_selection(
  p_capability TEXT,
  p_reason TEXT,
  p_actor_id UUID,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_selection_id UUID;
  v_removed JSONB;
  v_existing JSONB;
BEGIN
  IF p_capability IS NULL OR btrim(p_capability) = '' THEN RAISE EXCEPTION 'missing_capability'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;

  SELECT metadata INTO v_existing
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id AND action = 'ai_model_selection_reset';
  IF FOUND THEN RETURN COALESCE(v_existing, '{}'::jsonb) || jsonb_build_object('success', true, 'idempotent', true); END IF;

  SELECT id, to_jsonb(ai_model_selection) INTO v_selection_id, v_removed
  FROM public.ai_model_selection
  WHERE capability = p_capability
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', true, 'reset', false); END IF;

  DELETE FROM public.ai_model_selection WHERE id = v_selection_id;
  v_existing := jsonb_build_object('success', true, 'reset', true, 'capability', p_capability, 'removed', v_removed);
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, operation_id, metadata)
  VALUES (p_actor_id, 'ai_model_selection_reset', 'ai_model_selection', v_selection_id, btrim(p_reason), p_operation_id, v_existing);
  RETURN v_existing;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_ai_model_selection(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ai_model_selection(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION public.admin_reset_ai_model_selection(TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_ai_model_selection(TEXT, TEXT, UUID, UUID) TO service_role;

-- =============================================================================
-- 4. Auditoria F47 (preserva todos os valores já aceitos)
-- =============================================================================
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
  'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
  'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
  'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update',
  'ai_model_selection_update', 'ai_model_selection_reset'
));

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check CHECK (
  target_type IN ('store', 'user', 'campaign', 'access_request', 'feature_flag', 'ai_model_selection')
);

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente se necessário)
-- =============================================================================
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
--   CHECK (target_type IN ('store', 'user', 'campaign', 'access_request', 'feature_flag'));
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
--   'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
--   'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
--   'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update'
-- ));
-- REVOKE EXECUTE ON FUNCTION public.admin_reset_ai_model_selection(TEXT, TEXT, UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_reset_ai_model_selection(TEXT, TEXT, UUID, UUID);
-- REVOKE EXECUTE ON FUNCTION public.admin_set_ai_model_selection(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_set_ai_model_selection(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID);
-- DROP TABLE IF EXISTS public.ai_model_selection;
-- DROP TABLE IF EXISTS public.ai_model_catalog;
