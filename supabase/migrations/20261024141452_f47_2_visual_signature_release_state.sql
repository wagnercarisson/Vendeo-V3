-- =============================================================================
-- F47.2 — Migration corretiva de liberação da Assinatura Visual
-- Migration: 20261024141452_f47_2_visual_signature_release_state.sql
--
-- ADITIVA em relação à F47.1 (renumerada) e compatível com o código atualmente
-- publicado: o código antigo não consulta estas tabelas/RPCs.
--
-- Escopo:
--   1. Amplia o CHECK de environment_scope para `local_validation|production`.
--   2. Cria `visual_signature_model_config_release` (ponteiros de versão).
--   3. Cria `visual_signature_model_config_pilot_stores` (allowlist).
--   4. Cria a RPC de set v2, que invalida a liberação anterior.
--   5. Cria RPCs de publicação, ativação/desativação e reset por versão.
--   6. Remove as assinaturas antigas de set/reset para não deixar bypass.
--   7. Estende os CHECKs de auditoria preservando todos os valores existentes.
--   8. Bloco REVERT manual comentado (forward-only no projeto).
--
-- NÃO aplica migration, não altera ledger, não chama provider e não grava
-- configuração nesta migration.
-- =============================================================================

-- =============================================================================
-- 1. Ambiente: ampliar o CHECK existente sem alterar a linha local
-- =============================================================================
ALTER TABLE public.visual_signature_model_config
  DROP CONSTRAINT IF EXISTS chk_vs_environment;

ALTER TABLE public.visual_signature_model_config
  ADD CONSTRAINT chk_vs_environment
  CHECK (environment_scope IN ('local_validation', 'production'));

-- =============================================================================
-- 2. Estado de liberação vinculado à versão
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.visual_signature_model_config_release (
  scope                         TEXT PRIMARY KEY DEFAULT 'visual_signature',
  published_config_version_id   UUID NULL,
  activated_config_version_id   UUID NULL,
  activation_mode               TEXT NOT NULL DEFAULT 'none',
  environment_scope             TEXT NOT NULL DEFAULT 'local_validation',
  instance_identity             TEXT NOT NULL,
  updated_by                    UUID REFERENCES auth.users(id),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason                        TEXT,
  last_operation_id             UUID UNIQUE,
  CONSTRAINT chk_vs_release_scope CHECK (scope = 'visual_signature'),
  CONSTRAINT chk_vs_release_mode CHECK (activation_mode IN ('none', 'pilot', 'general')),
  CONSTRAINT chk_vs_release_environment CHECK (environment_scope IN ('local_validation', 'production')),
  CONSTRAINT chk_vs_release_identity CHECK (btrim(instance_identity) <> '')
);

COMMENT ON TABLE public.visual_signature_model_config_release IS
  'F47.2 — Ponteiros de publicação/ativação vinculados à config_version_id. Versão antiga não ativa a versão vigente.';

-- =============================================================================
-- 3. Allowlist de piloto
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.visual_signature_model_config_pilot_stores (
  store_id          UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  added_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by          UUID REFERENCES auth.users(id),
  last_operation_id UUID
);

COMMENT ON TABLE public.visual_signature_model_config_pilot_stores IS
  'F47.2 — Allowlist explícita do piloto da Assinatura Visual. Limpa na desativação/reset; composição anterior fica na auditoria.';

-- RLS e grants mínimos
ALTER TABLE public.visual_signature_model_config_release ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_signature_model_config_pilot_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage visual signature release"
  ON public.visual_signature_model_config_release;
CREATE POLICY "Service role can manage visual signature release"
  ON public.visual_signature_model_config_release FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage visual signature pilot stores"
  ON public.visual_signature_model_config_pilot_stores;
CREATE POLICY "Service role can manage visual signature pilot stores"
  ON public.visual_signature_model_config_pilot_stores FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.visual_signature_model_config_release FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.visual_signature_model_config_pilot_stores FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visual_signature_model_config_release TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visual_signature_model_config_pilot_stores TO service_role;

-- =============================================================================
-- 4. RPC de set v2 — ambiente explícito e invalidação da liberação anterior
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_visual_signature_model_config_v2(
  p_actor_id           UUID,
  p_orchestrator_model TEXT,
  p_image_preset       TEXT,
  p_reasoning_effort   TEXT,
  p_reason             TEXT,
  p_operation_id       UUID,
  p_environment_scope  TEXT,
  p_instance_identity  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_image_model          TEXT;
  v_image_quality        TEXT;
  v_existing_metadata    JSONB;
  v_existing_action      TEXT;
  v_config_version_id    UUID;
  v_previous_version_id  UUID;
  v_previous_pilot       JSONB;
  v_result               JSONB;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN
    RAISE EXCEPTION 'missing_instance_identity';
  END IF;
  IF p_environment_scope IS NULL OR p_environment_scope NOT IN ('local_validation', 'production') THEN
    RAISE EXCEPTION 'invalid_environment_scope';
  END IF;
  IF p_reasoning_effort IS DISTINCT FROM 'low' THEN RAISE EXCEPTION 'invalid_reasoning'; END IF;
  IF p_orchestrator_model IS NULL OR p_orchestrator_model NOT IN ('gpt-5.5', 'gpt-6-luna') THEN
    RAISE EXCEPTION 'invalid_orchestrator';
  END IF;

  CASE p_image_preset
    WHEN 'flare_low' THEN
      v_image_model := 'gpt-image-2.5-flare'; v_image_quality := 'low';
    WHEN 'flare_medium' THEN
      v_image_model := 'gpt-image-2.5-flare'; v_image_quality := 'medium';
    WHEN 'sunburst_low' THEN
      v_image_model := 'gpt-image-2.5-sunburst'; v_image_quality := 'low';
    WHEN 'sunburst_medium' THEN
      v_image_model := 'gpt-image-2.5-sunburst'; v_image_quality := 'medium';
    ELSE
      RAISE EXCEPTION 'invalid_preset';
  END CASE;

  -- Apenas as duas combinações com avaliação humana registrada são elegíveis.
  IF NOT (
    (p_orchestrator_model = 'gpt-5.5' AND p_image_preset = 'sunburst_medium')
    OR (p_orchestrator_model = 'gpt-6-luna' AND p_image_preset = 'sunburst_medium')
  ) THEN
    RAISE EXCEPTION 'preset_not_evaluated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('f47_2_visual_signature_model_config_release'));

  SELECT metadata, action INTO v_existing_metadata, v_existing_action
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing_action IS DISTINCT FROM 'visual_signature_model_config_update'
       OR v_existing_metadata ->> 'operation' IS DISTINCT FROM 'set'
       OR v_existing_metadata ->> 'actor_id' IS DISTINCT FROM p_actor_id::text
       OR v_existing_metadata ->> 'environment_scope' IS DISTINCT FROM p_environment_scope
       OR v_existing_metadata ->> 'orchestrator_model' IS DISTINCT FROM p_orchestrator_model
       OR v_existing_metadata ->> 'image_preset' IS DISTINCT FROM p_image_preset
       OR v_existing_metadata ->> 'image_model' IS DISTINCT FROM v_image_model
       OR v_existing_metadata ->> 'image_quality' IS DISTINCT FROM v_image_quality
       OR v_existing_metadata ->> 'reasoning_effort' IS DISTINCT FROM p_reasoning_effort
       OR v_existing_metadata ->> 'instance_identity' IS DISTINCT FROM btrim(p_instance_identity)
       OR v_existing_metadata ->> 'reason' IS DISTINCT FROM btrim(p_reason)
    THEN
      RAISE EXCEPTION 'operation_id_conflict';
    END IF;

    RETURN COALESCE(v_existing_metadata, '{}'::jsonb)
      || jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ai_model_catalog
    WHERE capability = 'visual_signature_image'
      AND provider = 'openai'
      AND model = p_orchestrator_model
      AND protocol = 'responses'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'orchestrator_not_in_catalog';
  END IF;

  -- Captura o estado anterior para a auditoria antes de invalidar a liberação.
  SELECT config_version_id INTO v_previous_version_id
  FROM public.visual_signature_model_config
  WHERE scope = 'visual_signature'
  FOR UPDATE;

  SELECT COALESCE(jsonb_agg(store_id ORDER BY store_id), '[]'::jsonb)
  INTO v_previous_pilot
  FROM public.visual_signature_model_config_pilot_stores;

  INSERT INTO public.visual_signature_model_config (
    scope, environment_scope, instance_identity, orchestrator_model,
    image_preset, image_model, image_quality, reasoning_effort,
    config_version_id, reason, updated_by, updated_at
  ) VALUES (
    'visual_signature', p_environment_scope, btrim(p_instance_identity), p_orchestrator_model,
    p_image_preset, v_image_model, v_image_quality, 'low',
    gen_random_uuid(), btrim(p_reason), p_actor_id, now()
  )
  ON CONFLICT (scope) DO UPDATE SET
    environment_scope = EXCLUDED.environment_scope,
    instance_identity = EXCLUDED.instance_identity,
    orchestrator_model = EXCLUDED.orchestrator_model,
    image_preset = EXCLUDED.image_preset,
    image_model = EXCLUDED.image_model,
    image_quality = EXCLUDED.image_quality,
    reasoning_effort = EXCLUDED.reasoning_effort,
    config_version_id = gen_random_uuid(),
    reason = EXCLUDED.reason,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at
  RETURNING config_version_id INTO v_config_version_id;

  INSERT INTO public.visual_signature_model_config_release (
    scope, published_config_version_id, activated_config_version_id,
    activation_mode, environment_scope, instance_identity,
    updated_by, updated_at, reason, last_operation_id
  ) VALUES (
    'visual_signature', NULL, NULL, 'none', p_environment_scope, btrim(p_instance_identity),
    p_actor_id, now(), 'configuration_replaced_requires_reapproval', p_operation_id
  )
  ON CONFLICT (scope) DO UPDATE SET
    published_config_version_id = NULL,
    activated_config_version_id = NULL,
    activation_mode = 'none',
    environment_scope = EXCLUDED.environment_scope,
    instance_identity = EXCLUDED.instance_identity,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at,
    reason = EXCLUDED.reason,
    last_operation_id = EXCLUDED.last_operation_id;

  DELETE FROM public.visual_signature_model_config_pilot_stores;

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'operation', 'set',
    'scope', 'visual_signature',
    'environment_scope', p_environment_scope,
    'actor_id', p_actor_id,
    'instance_identity', btrim(p_instance_identity),
    'orchestrator_model', p_orchestrator_model,
    'image_preset', p_image_preset,
    'image_model', v_image_model,
    'image_quality', v_image_quality,
    'reasoning_effort', 'low',
    'config_version_id', v_config_version_id,
    'previous_config_version_id', v_previous_version_id,
    'previous_pilot_stores', v_previous_pilot,
    'config_published', false,
    'config_activated', false,
    'activation_mode', 'none',
    'reason', btrim(p_reason)
  );

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id, 'visual_signature_model_config_update', 'visual_signature_model_config',
    v_config_version_id, btrim(p_reason), p_operation_id, v_result
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_visual_signature_model_config_v2(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_visual_signature_model_config_v2(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
) TO service_role;

-- =============================================================================
-- 5. Publicação/despublicação por versão
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_publish_visual_signature_model_config(
  p_actor_id                  UUID,
  p_published                 BOOLEAN,
  p_expected_config_version_id UUID,
  p_reason                    TEXT,
  p_operation_id              UUID,
  p_instance_identity         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_config_version_id UUID;
  v_config_environment TEXT;
  v_release           public.visual_signature_model_config_release%ROWTYPE;
  v_existing_metadata JSONB;
  v_existing_action   TEXT;
  v_result            JSONB;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_expected_config_version_id IS NULL THEN RAISE EXCEPTION 'missing_config_version_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN
    RAISE EXCEPTION 'missing_instance_identity';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('f47_2_visual_signature_model_config_release'));

  SELECT metadata, action INTO v_existing_metadata, v_existing_action
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing_action IS DISTINCT FROM 'visual_signature_model_config_publish'
       OR v_existing_metadata ->> 'operation' IS DISTINCT FROM 'publish'
       OR v_existing_metadata ->> 'actor_id' IS DISTINCT FROM p_actor_id::text
       OR v_existing_metadata ->> 'published' IS DISTINCT FROM p_published::text
       OR v_existing_metadata ->> 'expected_config_version_id' IS DISTINCT FROM p_expected_config_version_id::text
       OR v_existing_metadata ->> 'instance_identity' IS DISTINCT FROM btrim(p_instance_identity)
       OR v_existing_metadata ->> 'reason' IS DISTINCT FROM btrim(p_reason)
    THEN
      RAISE EXCEPTION 'operation_id_conflict';
    END IF;

    RETURN COALESCE(v_existing_metadata, '{}'::jsonb)
      || jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  SELECT config_version_id, environment_scope
  INTO v_config_version_id, v_config_environment
  FROM public.visual_signature_model_config
  WHERE scope = 'visual_signature'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'config_missing'; END IF;
  IF v_config_version_id IS DISTINCT FROM p_expected_config_version_id THEN
    RAISE EXCEPTION 'config_version_mismatch';
  END IF;

  SELECT * INTO v_release
  FROM public.visual_signature_model_config_release
  WHERE scope = 'visual_signature'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'release_state_missing'; END IF;

  IF p_published IS FALSE AND v_release.activated_config_version_id = v_config_version_id THEN
    RAISE EXCEPTION 'deactivate_required';
  END IF;

  UPDATE public.visual_signature_model_config_release
  SET published_config_version_id =
        CASE WHEN p_published THEN v_config_version_id ELSE NULL END,
      environment_scope = v_config_environment,
      instance_identity = btrim(p_instance_identity),
      updated_by = p_actor_id,
      updated_at = now(),
      reason = btrim(p_reason),
      last_operation_id = p_operation_id
  WHERE scope = 'visual_signature'
  RETURNING * INTO v_release;

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'operation', 'publish',
    'scope', 'visual_signature',
    'actor_id', p_actor_id,
    'instance_identity', btrim(p_instance_identity),
    'expected_config_version_id', p_expected_config_version_id,
    'published', p_published,
    'config_version_id', v_config_version_id,
    'published_config_version_id', v_release.published_config_version_id,
    'activated_config_version_id', v_release.activated_config_version_id,
    'activation_mode', v_release.activation_mode,
    'config_published', (v_release.published_config_version_id = v_config_version_id),
    'config_activated', (v_release.activated_config_version_id = v_config_version_id
      AND v_release.activation_mode <> 'none'),
    'reason', btrim(p_reason)
  );

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id, 'visual_signature_model_config_publish', 'visual_signature_model_config',
    v_config_version_id, btrim(p_reason), p_operation_id, v_result
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_publish_visual_signature_model_config(
  UUID, BOOLEAN, UUID, TEXT, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_visual_signature_model_config(
  UUID, BOOLEAN, UUID, TEXT, UUID, TEXT
) TO service_role;

-- =============================================================================
-- 6. Ativação/desativação por versão com allowlist
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_activate_visual_signature_model_config(
  p_actor_id                  UUID,
  p_expected_config_version_id UUID,
  p_mode                      TEXT,
  p_pilot_store_ids           UUID[],
  p_reason                    TEXT,
  p_operation_id              UUID,
  p_instance_identity         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_config_version_id UUID;
  v_config_environment TEXT;
  v_release           public.visual_signature_model_config_release%ROWTYPE;
  v_existing_metadata JSONB;
  v_existing_action   TEXT;
  v_previous_pilot    JSONB;
  v_previous_mode     TEXT;
  v_requested_pilot   JSONB;
  v_result            JSONB;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_expected_config_version_id IS NULL THEN RAISE EXCEPTION 'missing_config_version_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN
    RAISE EXCEPTION 'missing_instance_identity';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('none', 'pilot', 'general') THEN
    RAISE EXCEPTION 'invalid_activation_mode';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x), '[]'::jsonb)
  INTO v_requested_pilot
  FROM unnest(COALESCE(p_pilot_store_ids, ARRAY[]::UUID[])) AS x;

  PERFORM pg_advisory_xact_lock(hashtext('f47_2_visual_signature_model_config_release'));

  SELECT metadata, action INTO v_existing_metadata, v_existing_action
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing_action IS DISTINCT FROM 'visual_signature_model_config_activation'
       OR v_existing_metadata ->> 'operation' IS DISTINCT FROM 'activation'
       OR v_existing_metadata ->> 'actor_id' IS DISTINCT FROM p_actor_id::text
       OR v_existing_metadata ->> 'mode' IS DISTINCT FROM p_mode
       OR v_existing_metadata ->> 'expected_config_version_id' IS DISTINCT FROM p_expected_config_version_id::text
       OR v_existing_metadata ->> 'requested_pilot_stores' IS DISTINCT FROM v_requested_pilot::text
       OR v_existing_metadata ->> 'instance_identity' IS DISTINCT FROM btrim(p_instance_identity)
       OR v_existing_metadata ->> 'reason' IS DISTINCT FROM btrim(p_reason)
    THEN
      RAISE EXCEPTION 'operation_id_conflict';
    END IF;

    RETURN COALESCE(v_existing_metadata, '{}'::jsonb)
      || jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  SELECT config_version_id, environment_scope
  INTO v_config_version_id, v_config_environment
  FROM public.visual_signature_model_config
  WHERE scope = 'visual_signature'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'config_missing'; END IF;
  IF v_config_version_id IS DISTINCT FROM p_expected_config_version_id THEN
    RAISE EXCEPTION 'config_version_mismatch';
  END IF;

  SELECT * INTO v_release
  FROM public.visual_signature_model_config_release
  WHERE scope = 'visual_signature'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'release_state_missing'; END IF;

  SELECT COALESCE(jsonb_agg(store_id ORDER BY store_id), '[]'::jsonb)
  INTO v_previous_pilot
  FROM public.visual_signature_model_config_pilot_stores;
  v_previous_mode := v_release.activation_mode;

  IF p_mode = 'none' THEN
    UPDATE public.visual_signature_model_config_release
    SET activated_config_version_id = NULL,
        activation_mode = 'none',
        environment_scope = v_config_environment,
        instance_identity = btrim(p_instance_identity),
        updated_by = p_actor_id,
        updated_at = now(),
        reason = btrim(p_reason),
        last_operation_id = p_operation_id
    WHERE scope = 'visual_signature'
    RETURNING * INTO v_release;

    DELETE FROM public.visual_signature_model_config_pilot_stores;
  ELSE
    IF v_release.published_config_version_id IS DISTINCT FROM v_config_version_id THEN
      RAISE EXCEPTION 'config_not_published';
    END IF;

    IF p_mode = 'pilot' AND (p_pilot_store_ids IS NULL OR cardinality(p_pilot_store_ids) = 0) THEN
      RAISE EXCEPTION 'pilot_allowlist_required';
    END IF;
    IF p_mode = 'general' AND p_pilot_store_ids IS NOT NULL AND cardinality(p_pilot_store_ids) > 0 THEN
      RAISE EXCEPTION 'pilot_allowlist_not_allowed';
    END IF;

    IF p_mode = 'pilot' THEN
      IF EXISTS (
        SELECT 1
        FROM unnest(p_pilot_store_ids) AS s(store_id)
        LEFT JOIN public.stores st ON st.id = s.store_id
        WHERE s.store_id IS NULL OR st.id IS NULL
      ) THEN
        RAISE EXCEPTION 'invalid_pilot_store';
      END IF;
    END IF;

    UPDATE public.visual_signature_model_config_release
    SET activated_config_version_id = v_config_version_id,
        activation_mode = p_mode,
        environment_scope = v_config_environment,
        instance_identity = btrim(p_instance_identity),
        updated_by = p_actor_id,
        updated_at = now(),
        reason = btrim(p_reason),
        last_operation_id = p_operation_id
    WHERE scope = 'visual_signature'
    RETURNING * INTO v_release;

    DELETE FROM public.visual_signature_model_config_pilot_stores;
    IF p_mode = 'pilot' THEN
      INSERT INTO public.visual_signature_model_config_pilot_stores (
        store_id, added_by, last_operation_id
      )
      SELECT DISTINCT s.store_id, p_actor_id, p_operation_id
      FROM unnest(p_pilot_store_ids) AS s(store_id)
      ON CONFLICT (store_id) DO NOTHING;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'operation', 'activation',
    'scope', 'visual_signature',
    'actor_id', p_actor_id,
    'instance_identity', btrim(p_instance_identity),
    'expected_config_version_id', p_expected_config_version_id,
    'mode', p_mode,
    'requested_pilot_stores', v_requested_pilot,
    'previous_mode', v_previous_mode,
    'previous_pilot_stores', v_previous_pilot,
    'config_version_id', v_config_version_id,
    'published_config_version_id', v_release.published_config_version_id,
    'activated_config_version_id', v_release.activated_config_version_id,
    'config_published', (v_release.published_config_version_id = v_config_version_id),
    'config_activated', (v_release.activated_config_version_id = v_config_version_id
      AND v_release.activation_mode <> 'none'),
    'reason', btrim(p_reason)
  );

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id, 'visual_signature_model_config_activation', 'visual_signature_model_config',
    v_config_version_id, btrim(p_reason), p_operation_id, v_result
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_activate_visual_signature_model_config(
  UUID, UUID, TEXT, UUID[], TEXT, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_visual_signature_model_config(
  UUID, UUID, TEXT, UUID[], TEXT, UUID, TEXT
) TO service_role;

-- =============================================================================
-- 7. Reset por versão — exige desativação, limpa allowlist e audita composição
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_reset_visual_signature_model_config(
  p_actor_id                  UUID,
  p_expected_config_version_id UUID,
  p_reason                    TEXT,
  p_operation_id              UUID,
  p_instance_identity         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_config_version_id UUID;
  v_release           public.visual_signature_model_config_release%ROWTYPE;
  v_existing_metadata JSONB;
  v_existing_action   TEXT;
  v_previous_pilot    JSONB;
  v_previous_mode     TEXT;
  v_previous_published UUID;
  v_previous_activated UUID;
  v_result            JSONB;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_expected_config_version_id IS NULL THEN RAISE EXCEPTION 'missing_config_version_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN
    RAISE EXCEPTION 'missing_instance_identity';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('f47_2_visual_signature_model_config_release'));

  SELECT metadata, action INTO v_existing_metadata, v_existing_action
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing_action IS DISTINCT FROM 'visual_signature_model_config_reset'
       OR v_existing_metadata ->> 'operation' IS DISTINCT FROM 'reset'
       OR v_existing_metadata ->> 'actor_id' IS DISTINCT FROM p_actor_id::text
       OR v_existing_metadata ->> 'expected_config_version_id' IS DISTINCT FROM p_expected_config_version_id::text
       OR v_existing_metadata ->> 'instance_identity' IS DISTINCT FROM btrim(p_instance_identity)
       OR v_existing_metadata ->> 'reason' IS DISTINCT FROM btrim(p_reason)
    THEN
      RAISE EXCEPTION 'operation_id_conflict';
    END IF;

    RETURN COALESCE(v_existing_metadata, '{}'::jsonb)
      || jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  SELECT config_version_id INTO v_config_version_id
  FROM public.visual_signature_model_config
  WHERE scope = 'visual_signature'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'config_missing'; END IF;
  IF v_config_version_id IS DISTINCT FROM p_expected_config_version_id THEN
    RAISE EXCEPTION 'config_version_mismatch';
  END IF;

  SELECT * INTO v_release
  FROM public.visual_signature_model_config_release
  WHERE scope = 'visual_signature'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'release_state_missing'; END IF;
  IF v_release.activated_config_version_id = v_config_version_id THEN
    RAISE EXCEPTION 'deactivate_required';
  END IF;

  SELECT COALESCE(jsonb_agg(store_id ORDER BY store_id), '[]'::jsonb)
  INTO v_previous_pilot
  FROM public.visual_signature_model_config_pilot_stores;
  v_previous_mode := v_release.activation_mode;
  v_previous_published := v_release.published_config_version_id;
  v_previous_activated := v_release.activated_config_version_id;

  DELETE FROM public.visual_signature_model_config_pilot_stores;

  DELETE FROM public.visual_signature_model_config
  WHERE scope = 'visual_signature';

  UPDATE public.visual_signature_model_config_release
  SET published_config_version_id = NULL,
      activated_config_version_id = NULL,
      activation_mode = 'none',
      instance_identity = btrim(p_instance_identity),
      updated_by = p_actor_id,
      updated_at = now(),
      reason = btrim(p_reason),
      last_operation_id = p_operation_id
  WHERE scope = 'visual_signature';

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'removed', true,
    'operation', 'reset',
    'scope', 'visual_signature',
    'actor_id', p_actor_id,
    'instance_identity', btrim(p_instance_identity),
    'expected_config_version_id', p_expected_config_version_id,
    'config_version_id', v_config_version_id,
    'previous_published_config_version_id', v_previous_published,
    'previous_activated_config_version_id', v_previous_activated,
    'previous_activation_mode', v_previous_mode,
    'previous_pilot_stores', v_previous_pilot,
    'reason', btrim(p_reason)
  );

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id, 'visual_signature_model_config_reset', 'visual_signature_model_config',
    v_config_version_id, btrim(p_reason), p_operation_id, v_result
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_visual_signature_model_config(
  UUID, UUID, TEXT, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_visual_signature_model_config(
  UUID, UUID, TEXT, UUID, TEXT
) TO service_role;

-- =============================================================================
-- 8. Remover assinaturas antigas para não restar caminho de bypass
-- =============================================================================
DROP FUNCTION IF EXISTS public.admin_set_visual_signature_model_config(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
);
DROP FUNCTION IF EXISTS public.admin_reset_visual_signature_model_config(
  UUID, TEXT, UUID, TEXT
);

-- =============================================================================
-- 9. Auditoria — preserva todos os valores e adiciona publish/activation
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
  'image_model_pair_config_update',
  'product_1_1_pending_resolution',
  'access_request_invite',
  'visual_signature_model_config_update',
  'visual_signature_model_config_reset',
  'visual_signature_model_config_publish',
  'visual_signature_model_config_activation'
));

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check CHECK (
  target_type IN (
    'store', 'user', 'campaign', 'access_request', 'feature_flag', 'ai_model_selection',
    'support_credit_request', 'data_subject_request', 'image_model_pair_config',
    'visual_signature_model_config'
  )
);

-- =============================================================================
-- 10. Recuperação (forward-only)
-- =============================================================================
-- Política do projeto: forward-only. Para desativar:
--   1. `admin_activate_visual_signature_model_config(..., 'none', NULL, ...)`
--   2. `admin_reset_visual_signature_model_config(...)` após desativar.
-- Bloco REVERT manual (opcional; não é critério automático):
-- REVERT:
--   DROP FUNCTION IF EXISTS public.admin_reset_visual_signature_model_config(UUID, UUID, TEXT, UUID, TEXT);
--   DROP FUNCTION IF EXISTS public.admin_activate_visual_signature_model_config(UUID, UUID, TEXT, UUID[], TEXT, UUID, TEXT);
--   DROP FUNCTION IF EXISTS public.admin_publish_visual_signature_model_config(UUID, BOOLEAN, UUID, TEXT, UUID, TEXT);
--   DROP FUNCTION IF EXISTS public.admin_set_visual_signature_model_config_v2(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT);
--   DROP TABLE IF EXISTS public.visual_signature_model_config_pilot_stores;
--   DROP TABLE IF EXISTS public.visual_signature_model_config_release;
--   ALTER TABLE public.visual_signature_model_config DROP CONSTRAINT IF EXISTS chk_vs_environment;
--   ALTER TABLE public.visual_signature_model_config ADD CONSTRAINT chk_vs_environment
--     CHECK (environment_scope = 'local_validation');
--   (restaurar as RPCs antigas e os CHECKs de auditoria da F47.1)
