-- =============================================================================
-- F47.1 — Configuração dedicada de modelos da Assinatura Visual
-- Migration: 20261021000001_f47_1_visual_signature_model_config.sql
--
-- LOCAL-ONLY: esta migration é ADITIVA e deve ser aplicada SOMENTE no destino
-- local aprovado (`supabase migration up --local`), após autorização humana
-- explícita. NÃO usar `db push`, `--linked`, reset, `migration repair` ou
-- qualquer promoção remota.
--
-- Escopo:
--   1. Tabela singleton `visual_signature_model_config` (preset fechado,
--      reasoning fixo em low, versão congelável por operação).
--   2. RLS service_role only, sem grants a anon/authenticated.
--   3. RPC `admin_set_visual_signature_model_config` (SECURITY DEFINER,
--      `search_path=''`, ator/motivo/operation_id/instância obrigatórios,
--      derivação de modelo/qualidade no servidor, validação de catálogo,
--      idempotência por operation_id, auditoria na mesma transação).
--   4. RPC `admin_reset_visual_signature_model_config` (remove a linha com
--      auditoria e volta à seleção herdada).
--   5. Tupla de catálogo `visual_signature_image/openai/gpt-6-luna/responses`
--      ativa e idempotente, com falha explícita em divergência.
--   6. Extensão dos CHECKs de `admin_audit_log` preservando TODOS os valores.
--
-- NÃO altera `ai_model_selection`, `image_model_pair_config`, defaults do
-- registry nem `ai_model_pricing`.
-- =============================================================================

-- =============================================================================
-- 1. Tabela singleton da configuração dedicada
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.visual_signature_model_config (
  scope             TEXT PRIMARY KEY DEFAULT 'visual_signature',
  environment_scope TEXT NOT NULL DEFAULT 'local_validation',
  instance_identity TEXT NOT NULL,
  orchestrator_model TEXT NOT NULL,
  image_preset      TEXT NOT NULL,
  image_model       TEXT NOT NULL,
  image_quality     TEXT NOT NULL,
  reasoning_effort  TEXT NOT NULL DEFAULT 'low',
  config_version_id UUID NOT NULL DEFAULT gen_random_uuid(),
  reason            TEXT,
  updated_by        UUID REFERENCES auth.users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_vs_scope CHECK (scope = 'visual_signature'),
  CONSTRAINT chk_vs_environment CHECK (environment_scope = 'local_validation'),
  CONSTRAINT chk_vs_orchestrator CHECK (orchestrator_model IN ('gpt-5.5', 'gpt-6-luna')),
  CONSTRAINT chk_vs_quality CHECK (image_quality IN ('low', 'medium')),
  CONSTRAINT chk_vs_reasoning CHECK (reasoning_effort = 'low'),
  CONSTRAINT chk_vs_instance_identity CHECK (btrim(instance_identity) <> ''),
  CONSTRAINT chk_vs_preset_tuple CHECK (
    (image_preset = 'flare_low'       AND image_model = 'gpt-image-2.5-flare'    AND image_quality = 'low') OR
    (image_preset = 'flare_medium'    AND image_model = 'gpt-image-2.5-flare'    AND image_quality = 'medium') OR
    (image_preset = 'sunburst_low'    AND image_model = 'gpt-image-2.5-sunburst' AND image_quality = 'low') OR
    (image_preset = 'sunburst_medium' AND image_model = 'gpt-image-2.5-sunburst' AND image_quality = 'medium')
  )
);

COMMENT ON TABLE public.visual_signature_model_config IS
  'F47.1 — Configuração vigente SINGLETON da Assinatura Visual (local_validation). Separada de ai_model_selection e image_model_pair_config.';
COMMENT ON COLUMN public.visual_signature_model_config.config_version_id IS
  'Versão congelada por operação. Renovada a cada set; usada no snapshot antes de qualquer débito/provider.';

-- =============================================================================
-- 2. RLS service_role only
-- =============================================================================
ALTER TABLE public.visual_signature_model_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage visual signature model config"
  ON public.visual_signature_model_config;
CREATE POLICY "Service role can manage visual signature model config"
  ON public.visual_signature_model_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.visual_signature_model_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visual_signature_model_config TO service_role;

-- =============================================================================
-- 3. Catálogo: tupla Luna/Responses restrita à Assinatura Visual
-- =============================================================================
-- Inserção idempotente + verificação EXPLÍCITA de divergência (sem
-- `ON CONFLICT DO NOTHING` silencioso para estados divergentes).
INSERT INTO public.ai_model_catalog (
  capability, segment, provider, model, protocol, label, status, source_note, validated_at
) VALUES (
  'visual_signature_image', 'image', 'openai', 'gpt-6-luna', 'responses',
  'GPT-6 Luna (Responses)', 'active', 'F47.1 visual signature local validation', NULL
)
ON CONFLICT (capability, provider, model, protocol) DO NOTHING;

DO $f47_1_catalog_verify$
DECLARE
  v_segment TEXT;
  v_status TEXT;
BEGIN
  SELECT segment, status INTO v_segment, v_status
  FROM public.ai_model_catalog
  WHERE capability = 'visual_signature_image'
    AND provider = 'openai'
    AND model = 'gpt-6-luna'
    AND protocol = 'responses';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'f47_1_catalog_row_missing';
  END IF;

  IF v_segment <> 'image' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'f47_1_catalog_row_divergent (segment=%, status=%)', v_segment, v_status;
  END IF;
END;
$f47_1_catalog_verify$;

-- =============================================================================
-- 4. RPC administrativa `admin_set_visual_signature_model_config`
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_visual_signature_model_config(
  p_actor_id UUID,
  p_orchestrator_model TEXT,
  p_image_preset TEXT,
  p_reasoning_effort TEXT,
  p_reason TEXT,
  p_operation_id UUID,
  p_instance_identity TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_image_model TEXT;
  v_image_quality TEXT;
  v_existing_metadata JSONB;
  v_existing_action TEXT;
  v_config_version_id UUID;
  v_result JSONB;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN
    RAISE EXCEPTION 'missing_instance_identity';
  END IF;
  IF p_reasoning_effort IS DISTINCT FROM 'low' THEN RAISE EXCEPTION 'invalid_reasoning'; END IF;
  IF p_orchestrator_model IS NULL OR p_orchestrator_model NOT IN ('gpt-5.5', 'gpt-6-luna') THEN
    RAISE EXCEPTION 'invalid_orchestrator';
  END IF;

  -- Derivação de modelo/qualidade EXCLUSIVAMENTE no servidor.
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

  -- Serializa set/reset ANTES da consulta de idempotência. Sem esta trava,
  -- duas chamadas concorrentes com o mesmo operation_id podem ambas observar
  -- ausência e a segunda falha no índice único da auditoria em vez de retornar
  -- replay idempotente/conflito tipado. A trava é por transação e cobre a
  -- feature inteira, preservando a ordem singleton/auditoria.
  PERFORM pg_advisory_xact_lock(
    hashtext('f47_1_visual_signature_model_config')
  );

  -- Idempotência global por operation_id (índice único parcial). Um
  -- operation_id reutilizado por outra ação/conteúdo é conflito.
  SELECT metadata, action INTO v_existing_metadata, v_existing_action
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing_action IS DISTINCT FROM 'visual_signature_model_config_update'
       OR v_existing_metadata ->> 'operation' IS DISTINCT FROM 'set'
       OR v_existing_metadata ->> 'actor_id' IS DISTINCT FROM p_actor_id::text
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

  -- UPSERT singleton renovando versão, autor, timestamp e motivo.
  INSERT INTO public.visual_signature_model_config (
    scope, environment_scope, instance_identity, orchestrator_model,
    image_preset, image_model, image_quality, reasoning_effort,
    config_version_id, reason, updated_by, updated_at
  ) VALUES (
    'visual_signature', 'local_validation', btrim(p_instance_identity), p_orchestrator_model,
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

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'operation', 'set',
    'scope', 'visual_signature',
    'environment_scope', 'local_validation',
    'actor_id', p_actor_id,
    'instance_identity', btrim(p_instance_identity),
    'orchestrator_model', p_orchestrator_model,
    'image_preset', p_image_preset,
    'image_model', v_image_model,
    'image_quality', v_image_quality,
    'reasoning_effort', 'low',
    'config_version_id', v_config_version_id,
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

REVOKE EXECUTE ON FUNCTION public.admin_set_visual_signature_model_config(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_visual_signature_model_config(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
) TO service_role;

-- =============================================================================
-- 5. RPC administrativa `admin_reset_visual_signature_model_config`
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_reset_visual_signature_model_config(
  p_actor_id UUID,
  p_reason TEXT,
  p_operation_id UUID,
  p_instance_identity TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_metadata JSONB;
  v_existing_action TEXT;
  v_removed_version UUID;
  v_deleted INTEGER := 0;
  v_result JSONB;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN
    RAISE EXCEPTION 'missing_instance_identity';
  END IF;

  -- Mesma trava de feature do set: serializa reset × set e reset × reset antes
  -- de consultar idempotência, eliminando a janela de corrida do operation_id.
  PERFORM pg_advisory_xact_lock(
    hashtext('f47_1_visual_signature_model_config')
  );

  SELECT metadata, action INTO v_existing_metadata, v_existing_action
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing_action IS DISTINCT FROM 'visual_signature_model_config_reset'
       OR v_existing_metadata ->> 'operation' IS DISTINCT FROM 'reset'
       OR v_existing_metadata ->> 'actor_id' IS DISTINCT FROM p_actor_id::text
       OR v_existing_metadata ->> 'instance_identity' IS DISTINCT FROM btrim(p_instance_identity)
       OR v_existing_metadata ->> 'reason' IS DISTINCT FROM btrim(p_reason)
    THEN
      RAISE EXCEPTION 'operation_id_conflict';
    END IF;

    RETURN COALESCE(v_existing_metadata, '{}'::jsonb)
      || jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  DELETE FROM public.visual_signature_model_config
  WHERE scope = 'visual_signature'
  RETURNING config_version_id INTO v_removed_version;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', (v_deleted = 0),
    'removed', (v_deleted > 0),
    'operation', 'reset',
    'scope', 'visual_signature',
    'actor_id', p_actor_id,
    'instance_identity', btrim(p_instance_identity),
    'config_version_id', COALESCE(v_removed_version, gen_random_uuid()),
    'reason', btrim(p_reason)
  );

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id, 'visual_signature_model_config_reset', 'visual_signature_model_config',
    (v_result ->> 'config_version_id')::uuid, btrim(p_reason), p_operation_id, v_result
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_visual_signature_model_config(
  UUID, TEXT, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_visual_signature_model_config(
  UUID, TEXT, UUID, TEXT
) TO service_role;

-- =============================================================================
-- 6. Auditoria F47.1 — preserva TODOS os valores já aceitos
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
  'visual_signature_model_config_reset'
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
-- 7. Recuperação (forward-only)
-- =============================================================================
-- A política do projeto é forward-only. Para desativar a configuração dedicada:
--   1. Chamar `admin_reset_visual_signature_model_config` com ator/motivo
--      (remove a linha com auditoria e o runtime volta à seleção herdada); ou
--   2. Aplicar migration corretiva (ex.: desabilitar consumo/consumo da tabela).
-- Bloco REVERT manual (opcional; NÃO é critério automático de qualidade):
-- REVERT:
--   DROP FUNCTION IF EXISTS public.admin_reset_visual_signature_model_config(UUID, TEXT, UUID, TEXT);
--   DROP FUNCTION IF EXISTS public.admin_set_visual_signature_model_config(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);
--   DROP TABLE IF EXISTS public.visual_signature_model_config;
--   DELETE FROM public.ai_model_catalog
--     WHERE capability = 'visual_signature_image' AND provider = 'openai'
--       AND model = 'gpt-6-luna' AND protocol = 'responses';
--   (restaurar os CHECKs de admin_audit_log sem as duas actions/target_type da F47.1)
