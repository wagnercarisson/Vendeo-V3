-- Fix DELETE requires a WHERE clause in Visual Signature configuration RPCs.
-- Forward-only: do not edit the already applied F47.2/F47.3 migrations.
-- store_id is a NOT NULL primary key: preserve the intentional full cleanup.
-- CREATE OR REPLACE preserves function ownership and existing EXECUTE grants.
-- No data changes or disabling of safe-update protections in this migration.

CREATE OR REPLACE FUNCTION public.admin_set_visual_signature_model_config_v3(
  p_actor_id           UUID,
  p_orchestrator_model TEXT,
  p_image_model        TEXT,
  p_image_quality      TEXT,
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
  v_image_preset         TEXT;
  v_config_version_id    UUID;
  v_previous_version_id  UUID;
  v_previous_pilot       JSONB;
  v_existing_metadata    JSONB;
  v_existing_action      TEXT;
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

  -- Identificadores completos: modelo e qualidade são entradas não confiáveis
  -- e precisam ser validados contra listas fechadas antes da derivação.
  IF p_image_model IS NULL
     OR p_image_model NOT IN ('gpt-image-2.5-flare', 'gpt-image-2.5-sunburst') THEN
    RAISE EXCEPTION 'invalid_image_model';
  END IF;
  IF p_image_quality IS NULL
     OR p_image_quality NOT IN ('low', 'medium') THEN
    RAISE EXCEPTION 'invalid_image_quality';
  END IF;

  -- Derivação do preset EXCLUSIVAMENTE no servidor. O preset NÃO é parâmetro:
  -- é consequência determinística do par (modelo, qualidade). Qualquer par
  -- fora da matriz falha explicitamente — não existe ELSE silencioso.
  CASE
    WHEN p_image_model = 'gpt-image-2.5-flare' AND p_image_quality = 'low' THEN
      v_image_preset := 'flare_low';
    WHEN p_image_model = 'gpt-image-2.5-flare' AND p_image_quality = 'medium' THEN
      v_image_preset := 'flare_medium';
    WHEN p_image_model = 'gpt-image-2.5-sunburst' AND p_image_quality = 'low' THEN
      v_image_preset := 'sunburst_low';
    WHEN p_image_model = 'gpt-image-2.5-sunburst' AND p_image_quality = 'medium' THEN
      v_image_preset := 'sunburst_medium';
    ELSE
      RAISE EXCEPTION 'invalid_preset_tuple';
  END CASE;

  -- Mesma trava de feature da v2: serializa set/reset/publish/activation antes
  -- da consulta de idempotência, fechando a janela de corrida do operation_id.
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
       OR v_existing_metadata ->> 'image_preset' IS DISTINCT FROM v_image_preset
       OR v_existing_metadata ->> 'image_model' IS DISTINCT FROM p_image_model
       OR v_existing_metadata ->> 'image_quality' IS DISTINCT FROM p_image_quality
       OR v_existing_metadata ->> 'reasoning_effort' IS DISTINCT FROM p_reasoning_effort
       OR v_existing_metadata ->> 'instance_identity' IS DISTINCT FROM btrim(p_instance_identity)
       OR v_existing_metadata ->> 'reason' IS DISTINCT FROM btrim(p_reason)
    THEN
      RAISE EXCEPTION 'operation_id_conflict';
    END IF;

    RETURN COALESCE(v_existing_metadata, '{}'::jsonb)
      || jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- Orquestrador deve existir no catálogo para a capacidade da VS.
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
    v_image_preset, p_image_model, p_image_quality, 'low',
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

  -- Configuração nova exige reaprovação: publica/ativa ficam nulos e a
  -- allowlist de piloto é limpa.
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

  DELETE FROM public.visual_signature_model_config_pilot_stores
  WHERE store_id IS NOT NULL;

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'operation', 'set',
    'scope', 'visual_signature',
    'environment_scope', p_environment_scope,
    'actor_id', p_actor_id,
    'instance_identity', btrim(p_instance_identity),
    'orchestrator_model', p_orchestrator_model,
    'image_preset', v_image_preset,
    'image_model', p_image_model,
    'image_quality', p_image_quality,
    'reasoning_effort', 'low',
    'config_version_id', v_config_version_id,
    'previous_config_version_id', v_previous_version_id,
    'previous_pilot_stores', v_previous_pilot,
    'config_published', false,
    'config_activated', false,
    'activation_mode', 'none',
    'reason', btrim(p_reason)
  );

  -- Auditoria na MESMA transação.
  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id, 'visual_signature_model_config_update', 'visual_signature_model_config',
    v_config_version_id, btrim(p_reason), p_operation_id, v_result
  );

  RETURN v_result;
END;
$$;

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
  v_config_identity TEXT;
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

  SELECT config_version_id, environment_scope, instance_identity
  INTO v_config_version_id, v_config_environment, v_config_identity
  FROM public.visual_signature_model_config
  WHERE scope = 'visual_signature'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'config_missing'; END IF;
  IF v_config_version_id IS DISTINCT FROM p_expected_config_version_id THEN
    RAISE EXCEPTION 'config_version_mismatch';
  END IF;
  IF btrim(p_instance_identity) IS DISTINCT FROM v_config_identity THEN
    RAISE EXCEPTION 'instance_identity_mismatch';
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

    DELETE FROM public.visual_signature_model_config_pilot_stores
  WHERE store_id IS NOT NULL;
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

    DELETE FROM public.visual_signature_model_config_pilot_stores
  WHERE store_id IS NOT NULL;
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
  v_config_environment TEXT;
  v_config_identity TEXT;
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

  SELECT config_version_id, environment_scope, instance_identity
  INTO v_config_version_id, v_config_environment, v_config_identity
  FROM public.visual_signature_model_config
  WHERE scope = 'visual_signature'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'config_missing'; END IF;
  IF v_config_version_id IS DISTINCT FROM p_expected_config_version_id THEN
    RAISE EXCEPTION 'config_version_mismatch';
  END IF;
  IF btrim(p_instance_identity) IS DISTINCT FROM v_config_identity THEN
    RAISE EXCEPTION 'instance_identity_mismatch';
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

  DELETE FROM public.visual_signature_model_config_pilot_stores
  WHERE store_id IS NOT NULL;

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

