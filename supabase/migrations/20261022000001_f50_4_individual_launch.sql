-- =============================================================================
-- F50.4 — Oferta de onboarding individualizada por CNPJ completo
-- Migration M1/3: marco proprio da F50.4 (individual_launch_at) + RPC de ativacao.
--
-- Escopo:
--   1. Adiciona public.trial_offer_settings.individual_launch_at (NULL por padrao).
--   2. Cria public.admin_activate_trial_offer_individual_launch: grava o marco
--      uma unica vez, de forma idempotente por operation_id e auditada.
--
-- Regras:
--   - NENHUM valor e gravado por este arquivo. individual_launch_at permanece NULL
--     apos a migration; a F50.4 fica inativa e o comportamento F50.2/legado vale.
--   - launch_at da F50.2 NAO e alterado por esta migration nem pela RPC.
--   - A RPC nao cria enrollment, nao altera saldos, transacoes ou entitlements.
--   - Nenhuma migration e aplicada em producao por este arquivo.
-- =============================================================================

-- =============================================================================
-- 1. Coluna do marco individual da F50.4
-- =============================================================================
ALTER TABLE public.trial_offer_settings
  ADD COLUMN IF NOT EXISTS individual_launch_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.trial_offer_settings.individual_launch_at IS
  'Marco proprio da F50.4. NULL mantem a F50.4 inativa (comportamento F50.2/legado). Gravado uma unica vez, de forma irreversivel, apenas pela RPC administrativa auditada; nunca gravado por deploy ou migration.';

-- =============================================================================
-- 2. RPC administrativa de ativacao do marco (idempotente e auditada)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_activate_trial_offer_individual_launch(
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
  v_individual_launch_at TIMESTAMPTZ;
  v_audit_actor UUID;
  v_audit_reason TEXT;
  v_audit_kind TEXT;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'missing_actor';
  END IF;

  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'missing_operation_id';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'missing_reason';
  END IF;

  SELECT id, enabled, launch_at, individual_launch_at
  INTO v_id, v_enabled, v_launch_at, v_individual_launch_at
  FROM public.trial_offer_settings
  WHERE offer_key = 'trial_28d_v1'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'settings_not_found';
  END IF;

  -- Replay idempotente: a auditoria da mesma operacao e a fonte de verdade.
  -- Replay com conteudo divergente falha; replay identico nao grava de novo.
  SELECT actor_id, reason, metadata->>'kind'
  INTO v_audit_actor, v_audit_reason, v_audit_kind
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id
    AND action = 'feature_flag_update'
    AND target_type = 'feature_flag'
    AND target_id = v_id
    AND metadata->>'kind' = 'trial_offer_individual_launch'
  LIMIT 1;

  IF FOUND THEN
    IF v_audit_actor IS DISTINCT FROM p_actor_id
       OR btrim(v_audit_reason) IS DISTINCT FROM btrim(p_reason)
       OR v_audit_kind IS DISTINCT FROM 'trial_offer_individual_launch' THEN
      RAISE EXCEPTION 'operation_id_conflict';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'individual_launch_at', v_individual_launch_at,
      'cohort_state', 'active'
    );
  END IF;

  -- Recusas fail-closed: sem chave ligada, sem marco anterior ou marco ja gravado.
  IF v_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'trial_offer_not_enabled';
  END IF;

  IF v_launch_at IS NULL THEN
    RAISE EXCEPTION 'launch_at_missing';
  END IF;

  IF v_individual_launch_at IS NOT NULL THEN
    RAISE EXCEPTION 'individual_launch_already_set';
  END IF;

  IF now() < v_launch_at THEN
    RAISE EXCEPTION 'individual_launch_before_launch_at';
  END IF;

  -- Gravacao unica do marco. Nao toca launch_at, enabled nem outras tabelas.
  UPDATE public.trial_offer_settings
  SET individual_launch_at = now()
  WHERE id = v_id
  RETURNING individual_launch_at INTO v_individual_launch_at;

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id,
    'feature_flag_update',
    'feature_flag',
    v_id,
    btrim(p_reason),
    p_operation_id,
    jsonb_build_object(
      'kind', 'trial_offer_individual_launch',
      'offer_key', 'trial_28d_v1',
      'previous_individual_launch_at', NULL,
      'new_individual_launch_at', v_individual_launch_at,
      'launch_at', v_launch_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'individual_launch_at', v_individual_launch_at,
    'cohort_state', 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_activate_trial_offer_individual_launch(UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_trial_offer_individual_launch(UUID, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- REVERT (comentado) — condicionado, nao executar automaticamente
-- =============================================================================
-- Somente antes da ativacao e apos confirmar que NAO existe enrollment com
-- policy_cohort = 'per_cnpj_f50_4'. Nao executar DROP de coluna em bloco automatico.
-- REVOKE EXECUTE ON FUNCTION public.admin_activate_trial_offer_individual_launch(UUID, TEXT, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_activate_trial_offer_individual_launch(UUID, TEXT, UUID);
-- ALTER TABLE public.trial_offer_settings DROP COLUMN IF EXISTS individual_launch_at;
