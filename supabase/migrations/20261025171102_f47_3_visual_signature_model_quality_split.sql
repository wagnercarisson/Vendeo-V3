-- =============================================================================
-- F47.3 — Persistência de modelo e qualidade separados na Assinatura Visual
-- Migration: 20261025171102_f47_3_visual_signature_model_quality_split.sql
--
-- ADITIVA/CORRETIVA em relação à F47.1 e F47.2.
--
-- Contexto: a tabela `public.visual_signature_model_config` e o CHECK
-- `chk_vs_preset_tuple` (F47.1, seção 1) JÁ aceitam as quatro combinações
-- modelo × qualidade. O bloqueio real estava na RPC de set v2 (F47.2), que
-- tratava `p_image_preset` como fonte independente e rejeitava tudo que não
-- fosse `sunburst_medium` com erro de avaliação. Nenhuma linha desta
-- migration altera a tabela, seus CHECKs ou seus grants.
--
-- Escopo:
--   1. RPC v3 `admin_set_visual_signature_model_config_v3` recebendo
--      `p_image_model` e `p_image_quality` SEPARADOS e derivando
--      `image_preset` EXCLUSIVAMENTE no servidor (CASE explícito).
--   2. Remoção do bloqueio de avaliação humana (a restrição que exigia uma
--      combinação específica e rejeitava as demais).
--   3. `DROP FUNCTION` da v2, eliminando o overload contraditório.
--   4. Bloco REVERT manual comentado (política forward-only do projeto).
--
-- NÃO altera: tabela/CHECKs `visual_signature_model_config`, tabelas de
-- liberação e allowlist, reset, publish, activation, catálogo de modelos,
-- pricing, flags ou qualquer código de aplicação.
--
-- NÃO aplica migration, não toca ledger, não chama provider e não grava
-- configuração nesta migration.
-- =============================================================================

-- =============================================================================
-- 1. RPC de set v3 — modelo e qualidade separados, preset derivado no servidor
-- =============================================================================
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

REVOKE EXECUTE ON FUNCTION public.admin_set_visual_signature_model_config_v3(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_visual_signature_model_config_v3(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
) TO service_role;

-- =============================================================================
-- 2. Remover a v2 — elimina o overload que tratava preset como fonte
--    independente e mantinha o bloqueio de avaliação.
-- =============================================================================
DROP FUNCTION IF EXISTS public.admin_set_visual_signature_model_config_v2(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT);

-- =============================================================================
-- 3. Recuperação (forward-only)
-- =============================================================================
-- Política do projeto: forward-only. Para reverter manualmente (opcional; NÃO
-- é critério automático de qualidade), em ambiente autorizado:
-- REVERT:
--   1. Garantir que nenhum consumidor chame a v3.
--   2. DROP FUNCTION IF EXISTS
--        public.admin_set_visual_signature_model_config_v3(
--          UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
--        );
--   3. Recriar a v2 original exatamente como em
--        `supabase/migrations/20261024141452_f47_2_visual_signature_release_state.sql`
--      (seção 4, linhas 98-287), com a assinatura de 8 argumentos
--      (UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) e o bloqueio de
--      avaliação humana restaurado (ver o RAISE correspondente no arquivo v2).
--   Nenhuma tabela, CHECK, grant, tabela de liberação ou allowlist é alterada
--   nesta migration e, portanto, nada precisa ser restaurado nessas estruturas.
