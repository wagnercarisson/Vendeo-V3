-- =============================================================================
-- F50.2 — Oferta de teste gratuito de 28 dias
-- Migration 01/04: chave/marco, conclusão do onboarding e RPC administrativa.
--
-- Escopo:
--   1. trial_offer_settings (singleton por offer_key) com enabled + launch_at.
--   2. stores.onboarding_completed_at.
--   3. admin_set_trial_offer_enabled: ativa/desativa + auditoria existente.
--
-- Regras:
--   - launch_at só recebe valor quando p_enabled=true E launch_at é nulo.
--   - desabilitar não altera launch_at nem enrollments.
--   - auditoria reutiliza admin_audit_log (action/target_type existentes).
--   - NENHUMA migration é aplicada por este arquivo em produção.
-- =============================================================================

-- =============================================================================
-- 1. trial_offer_settings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.trial_offer_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  launch_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trial_offer_settings IS
  'Configuração da oferta de teste gratuito. launch_at é o marco de elegibilidade por auth.users.created_at.';
COMMENT ON COLUMN public.trial_offer_settings.enabled IS
  'Chave de novas adesões. Desabilitar não cancela enrollments existentes.';
COMMENT ON COLUMN public.trial_offer_settings.launch_at IS
  'Marco gravado apenas na primeira ativação (p_enabled=true e launch_at nulo).';

INSERT INTO public.trial_offer_settings (offer_key, enabled, launch_at)
VALUES ('trial_28d_v1', false, NULL)
ON CONFLICT (offer_key) DO NOTHING;

ALTER TABLE public.trial_offer_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trial_offer_settings FROM anon;
REVOKE ALL ON TABLE public.trial_offer_settings FROM authenticated;
REVOKE ALL ON TABLE public.trial_offer_settings FROM service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.trial_offer_settings TO service_role;

-- =============================================================================
-- 2. stores.onboarding_completed_at
-- =============================================================================
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.stores.onboarding_completed_at IS
  'Primeiro instante em que check_store_readiness retornou ready=true. Gravado uma única vez.';

-- =============================================================================
-- 3. admin_set_trial_offer_enabled
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_trial_offer_enabled(
  p_enabled BOOLEAN,
  p_actor_id UUID,
  p_reason TEXT,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_enabled BOOLEAN;
  v_launch_at TIMESTAMPTZ;
  v_new_launch_at TIMESTAMPTZ;
  v_audit_actor UUID;
  v_audit_reason TEXT;
  v_audit_enabled BOOLEAN;
BEGIN
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'missing_enabled';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'missing_reason';
  END IF;

  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'missing_operation_id';
  END IF;

  SELECT id, enabled, launch_at
  INTO v_id, v_enabled, v_launch_at
  FROM public.trial_offer_settings
  WHERE offer_key = 'trial_28d_v1'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trial_offer_settings_not_found';
  END IF;

  -- Idempotência pela auditoria existente (operation_id único).
  -- Replay com conteúdo divergente deve falhar, não retornar sucesso.
  SELECT actor_id, reason, (metadata->>'new_enabled')::boolean
  INTO v_audit_actor, v_audit_reason, v_audit_enabled
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id
    AND action = 'feature_flag_update'
    AND target_type = 'feature_flag'
    AND target_id = v_id
  LIMIT 1;

  IF FOUND THEN
    IF v_audit_actor IS DISTINCT FROM p_actor_id
       OR btrim(v_audit_reason) IS DISTINCT FROM btrim(p_reason)
       OR v_audit_enabled IS DISTINCT FROM p_enabled THEN
      RAISE EXCEPTION 'operation_id_conflict';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'id', v_id,
      'enabled', v_enabled,
      'launch_at', v_launch_at
    );
  END IF;

  v_new_launch_at := v_launch_at;
  IF p_enabled IS TRUE AND v_launch_at IS NULL THEN
    v_new_launch_at := now();
  END IF;

  UPDATE public.trial_offer_settings
  SET enabled = p_enabled,
      launch_at = v_new_launch_at,
      updated_by = p_actor_id,
      updated_at = now()
  WHERE id = v_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id,
    'feature_flag_update',
    'feature_flag',
    v_id,
    p_reason,
    p_operation_id,
    jsonb_build_object(
      'kind', 'trial_offer_settings',
      'offer_key', 'trial_28d_v1',
      'old_enabled', v_enabled,
      'new_enabled', p_enabled,
      'old_launch_at', v_launch_at,
      'new_launch_at', v_new_launch_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'id', v_id,
    'enabled', p_enabled,
    'launch_at', v_new_launch_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_trial_offer_enabled(BOOLEAN, UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_trial_offer_enabled(BOOLEAN, UUID, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- REVERT (comentado)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.admin_set_trial_offer_enabled(BOOLEAN, UUID, TEXT, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_set_trial_offer_enabled(BOOLEAN, UUID, TEXT, UUID);
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS onboarding_completed_at;
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.trial_offer_settings FROM service_role;
-- DROP TABLE IF EXISTS public.trial_offer_settings;
