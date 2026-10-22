-- =============================================================================
-- F50.4 — Prova SQL da Migration M1
-- Arquivo: tests/sql/f50_4_m1_activation.sql
--
-- Executar em PostgreSQL descartavel (plano 50.4-08). Script unico, transacional,
-- com ROLLBACK no final: nada persiste.
--
-- Cobre:
--   1. Primeira ativacao grava individual_launch_at sem tocar launch_at.
--   2. Replay idempotente por operation_id nao cria segunda linha de auditoria.
--   3. Recusas fail-closed (not_enabled, launch_at_missing, already_set, missing_reason,
--      operation_id_conflict).
--   4. Desligar/ligar a chave preserva launch_at/individual_launch_at e nao altera
--      saldos, transacoes, entitlements nem parcelas.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
-- Ator de auditoria (FK para auth.users).
INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES (
  '00000000-0000-4000-8000-0000000004a1',
  'authenticated',
  'authenticated',
  'f50-4-m1@test.local',
  '2026-10-01T00:00:00Z',
  '2026-10-01T00:00:00Z'
);

-- Estado de partida conforme contrato F50.2: oferta ligada, launch_at fixo,
-- individual_launch_at nulo (F50.4 inativa).
UPDATE public.trial_offer_settings
SET enabled = true,
    launch_at = TIMESTAMPTZ '2026-10-20T21:25:31.344856Z',
    individual_launch_at = NULL
WHERE offer_key = 'trial_28d_v1';

-- Limpa auditoria de teste da operacao principal.
DELETE FROM public.admin_audit_log
WHERE operation_id IN (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-0000000000a2',
  '00000000-0000-4000-8000-0000000000a3',
  '00000000-0000-4000-8000-0000000000a4',
  '00000000-0000-4000-8000-0000000000a5'
);

-- Snapshots comparaveis antes/depois (saldos, transacoes, entitlements, parcelas).
CREATE TEMP TABLE f50_4_m1_snapshots (
  label TEXT PRIMARY KEY,
  value TEXT NOT NULL
) ON COMMIT DROP;

-- -----------------------------------------------------------------------------
-- 1. Snapshot inicial
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO f50_4_m1_snapshots (label, value)
  SELECT 'before', jsonb_build_object(
    'balances', (SELECT jsonb_build_object(
        'count', count(*),
        'sum_balance', COALESCE(sum(balance), 0),
        'sum_bonus', COALESCE(sum(bonus_balance), 0),
        'sum_purchased', COALESCE(sum(purchased_balance), 0))
      FROM public.credit_balances),
    'transactions', (SELECT jsonb_build_object(
        'count', count(*),
        'sum_amount', COALESCE(sum(amount), 0),
        'checksum', COALESCE(md5(string_agg(id::text || ':' || amount::text, ',' ORDER BY id)), 'empty'))
      FROM public.credit_transactions),
    'entitlements', (SELECT jsonb_build_object(
        'count', count(*),
        'checksum', COALESCE(md5(string_agg(id::text || ':' || benefit_type, ',' ORDER BY id)), 'empty'))
      FROM public.freemium_entitlements),
    'enrollments', (SELECT jsonb_build_object(
        'count', count(*),
        'sum_granted_total', COALESCE(sum(granted_total), 0),
        'max_last_granted_seq', COALESCE(max(last_granted_seq), -1),
        'min_expires_at', COALESCE(min(expires_at)::text, 'none'))
      FROM public.trial_offer_enrollments)
  )::text;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Primeira ativacao grava o marco, mantem launch_at e audita uma vez
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_launch_before TIMESTAMPTZ;
  v_result JSONB;
  v_individual TIMESTAMPTZ;
  v_launch_after TIMESTAMPTZ;
  v_audit_count INTEGER;
BEGIN
  SELECT launch_at INTO v_launch_before
  FROM public.trial_offer_settings WHERE offer_key = 'trial_28d_v1';

  v_result := public.admin_activate_trial_offer_individual_launch(
    '00000000-0000-4000-8000-0000000004a1',
    'ativacao de teste M1',
    '00000000-0000-4000-8000-0000000000a1'
  );

  IF (v_result->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: primeira ativacao nao retornou success=true (%)', v_result;
  END IF;

  IF (v_result->>'idempotent')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: primeira ativacao deveria ter idempotent=false (%)', v_result;
  END IF;

  IF (v_result->>'cohort_state') <> 'active' THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: cohort_state inesperado (%)', v_result;
  END IF;

  SELECT individual_launch_at, launch_at
  INTO v_individual, v_launch_after
  FROM public.trial_offer_settings WHERE offer_key = 'trial_28d_v1';

  IF v_individual IS NULL THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: individual_launch_at permaneceu nulo apos ativacao';
  END IF;

  IF v_launch_after IS DISTINCT FROM v_launch_before THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: launch_at foi alterado pela ativacao (% -> %)', v_launch_before, v_launch_after;
  END IF;

  IF (v_result->>'individual_launch_at')::timestamptz IS DISTINCT FROM v_individual THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: retorno nao reflete individual_launch_at gravado';
  END IF;

  SELECT count(*) INTO v_audit_count
  FROM public.admin_audit_log
  WHERE operation_id = '00000000-0000-4000-8000-0000000000a1'
    AND action = 'feature_flag_update'
    AND target_type = 'feature_flag'
    AND metadata->>'kind' = 'trial_offer_individual_launch';

  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: esperava 1 linha de auditoria, encontrou %', v_audit_count;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Replay idempotente nao grava de novo
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_result JSONB;
  v_individual_before TIMESTAMPTZ;
  v_individual_after TIMESTAMPTZ;
  v_audit_count INTEGER;
BEGIN
  SELECT individual_launch_at INTO v_individual_before
  FROM public.trial_offer_settings WHERE offer_key = 'trial_28d_v1';

  v_result := public.admin_activate_trial_offer_individual_launch(
    '00000000-0000-4000-8000-0000000004a1',
    'ativacao de teste M1',
    '00000000-0000-4000-8000-0000000000a1'
  );

  IF (v_result->>'idempotent')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: replay deveria retornar idempotent=true (%)', v_result;
  END IF;

  SELECT individual_launch_at INTO v_individual_after
  FROM public.trial_offer_settings WHERE offer_key = 'trial_28d_v1';

  IF v_individual_after IS DISTINCT FROM v_individual_before THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: replay alterou individual_launch_at';
  END IF;

  SELECT count(*) INTO v_audit_count
  FROM public.admin_audit_log
  WHERE operation_id = '00000000-0000-4000-8000-0000000000a1'
    AND metadata->>'kind' = 'trial_offer_individual_launch';

  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: replay criou auditoria duplicada (count=%)', v_audit_count;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Replay com conteudo divergente falha com operation_id_conflict
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_msg TEXT;
BEGIN
  BEGIN
    PERFORM public.admin_activate_trial_offer_individual_launch(
      '00000000-0000-4000-8000-0000000004a1',
      'motivo divergente',
      '00000000-0000-4000-8000-0000000000a1'
    );
    RAISE EXCEPTION 'F50_4_M1_ASSERT: replay divergente deveria falhar';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg <> 'operation_id_conflict' THEN
        RAISE EXCEPTION 'F50_4_M1_ASSERT: esperava operation_id_conflict, recebeu %', v_msg;
      END IF;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Snapshot depois da ativacao: nada financeiro mudou
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_before TEXT;
  v_after TEXT;
BEGIN
  INSERT INTO f50_4_m1_snapshots (label, value)
  SELECT 'after_activation', jsonb_build_object(
    'balances', (SELECT jsonb_build_object(
        'count', count(*),
        'sum_balance', COALESCE(sum(balance), 0),
        'sum_bonus', COALESCE(sum(bonus_balance), 0),
        'sum_purchased', COALESCE(sum(purchased_balance), 0))
      FROM public.credit_balances),
    'transactions', (SELECT jsonb_build_object(
        'count', count(*),
        'sum_amount', COALESCE(sum(amount), 0),
        'checksum', COALESCE(md5(string_agg(id::text || ':' || amount::text, ',' ORDER BY id)), 'empty'))
      FROM public.credit_transactions),
    'entitlements', (SELECT jsonb_build_object(
        'count', count(*),
        'checksum', COALESCE(md5(string_agg(id::text || ':' || benefit_type, ',' ORDER BY id)), 'empty'))
      FROM public.freemium_entitlements),
    'enrollments', (SELECT jsonb_build_object(
        'count', count(*),
        'sum_granted_total', COALESCE(sum(granted_total), 0),
        'max_last_granted_seq', COALESCE(max(last_granted_seq), -1),
        'min_expires_at', COALESCE(min(expires_at)::text, 'none'))
      FROM public.trial_offer_enrollments)
  )::text;

  SELECT value INTO v_before FROM f50_4_m1_snapshots WHERE label = 'before';
  SELECT value INTO v_after FROM f50_4_m1_snapshots WHERE label = 'after_activation';

  IF v_before IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: ativacao alterou estado financeiro/enrollments. before=% after=%', v_before, v_after;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Desligar a chave preserva marcos e nao apaga/alterar nada
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_launch_before TIMESTAMPTZ;
  v_individual_before TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  SELECT launch_at, individual_launch_at
  INTO v_launch_before, v_individual_before
  FROM public.trial_offer_settings WHERE offer_key = 'trial_28d_v1';

  v_result := public.admin_set_trial_offer_enabled(
    false,
    '00000000-0000-4000-8000-0000000004a1',
    'desligar oferta no teste M1',
    '00000000-0000-4000-8000-0000000000a2'
  );

  IF (v_result->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: desligar a chave falhou (%)', v_result;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trial_offer_settings
    WHERE offer_key = 'trial_28d_v1'
      AND (enabled IS DISTINCT FROM false
        OR launch_at IS DISTINCT FROM v_launch_before
        OR individual_launch_at IS DISTINCT FROM v_individual_before)
  ) THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: desligar alterou enabled/launch_at/individual_launch_at';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Recusa com chave desligada: trial_offer_not_enabled
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_msg TEXT;
BEGIN
  BEGIN
    PERFORM public.admin_activate_trial_offer_individual_launch(
      '00000000-0000-4000-8000-0000000004a1',
      'tentativa com chave desligada',
      '00000000-0000-4000-8000-0000000000a3'
    );
    RAISE EXCEPTION 'F50_4_M1_ASSERT: ativacao com enabled=false deveria falhar';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg <> 'trial_offer_not_enabled' THEN
        RAISE EXCEPTION 'F50_4_M1_ASSERT: esperava trial_offer_not_enabled, recebeu %', v_msg;
      END IF;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Recusa com launch_at nulo: launch_at_missing
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_msg TEXT;
BEGIN
  UPDATE public.trial_offer_settings
  SET enabled = true,
      launch_at = NULL,
      individual_launch_at = NULL
  WHERE offer_key = 'trial_28d_v1';

  BEGIN
    PERFORM public.admin_activate_trial_offer_individual_launch(
      '00000000-0000-4000-8000-0000000004a1',
      'tentativa sem launch_at',
      '00000000-0000-4000-8000-0000000000a4'
    );
    RAISE EXCEPTION 'F50_4_M1_ASSERT: ativacao sem launch_at deveria falhar';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg <> 'launch_at_missing' THEN
        RAISE EXCEPTION 'F50_4_M1_ASSERT: esperava launch_at_missing, recebeu %', v_msg;
      END IF;
  END;

  UPDATE public.trial_offer_settings
  SET launch_at = TIMESTAMPTZ '2026-10-20T21:25:31.344856Z'
  WHERE offer_key = 'trial_28d_v1';
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Recusa de segunda gravacao: individual_launch_already_set
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_msg TEXT;
BEGIN
  UPDATE public.trial_offer_settings
  SET enabled = true,
      individual_launch_at = TIMESTAMPTZ '2026-10-21T00:00:00Z'
  WHERE offer_key = 'trial_28d_v1';

  BEGIN
    PERFORM public.admin_activate_trial_offer_individual_launch(
      '00000000-0000-4000-8000-0000000004a1',
      'tentativa de segunda gravacao',
      '00000000-0000-4000-8000-0000000000a5'
    );
    RAISE EXCEPTION 'F50_4_M1_ASSERT: segunda gravacao deveria falhar';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg <> 'individual_launch_already_set' THEN
        RAISE EXCEPTION 'F50_4_M1_ASSERT: esperava individual_launch_already_set, recebeu %', v_msg;
      END IF;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. Recusa de motivo vazio: missing_reason (e actor/operation obrigatorios)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_msg TEXT;
BEGIN
  BEGIN
    PERFORM public.admin_activate_trial_offer_individual_launch(
      '00000000-0000-4000-8000-0000000004a1',
      '   ',
      '00000000-0000-4000-8000-0000000000a6'
    );
    RAISE EXCEPTION 'F50_4_M1_ASSERT: motivo vazio deveria falhar';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg <> 'missing_reason' THEN
        RAISE EXCEPTION 'F50_4_M1_ASSERT: esperava missing_reason, recebeu %', v_msg;
      END IF;
  END;

  BEGIN
    PERFORM public.admin_activate_trial_offer_individual_launch(
      NULL,
      'motivo valido',
      '00000000-0000-4000-8000-0000000000a7'
    );
    RAISE EXCEPTION 'F50_4_M1_ASSERT: ator nulo deveria falhar';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg <> 'missing_actor' THEN
        RAISE EXCEPTION 'F50_4_M1_ASSERT: esperava missing_actor, recebeu %', v_msg;
      END IF;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. Reativar a chave nao altera individual_launch_at nem launch_at
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_launch_before TIMESTAMPTZ;
  v_individual_before TIMESTAMPTZ;
  v_launch_after TIMESTAMPTZ;
  v_individual_after TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  UPDATE public.trial_offer_settings
  SET enabled = false,
      launch_at = TIMESTAMPTZ '2026-10-20T21:25:31.344856Z',
      individual_launch_at = TIMESTAMPTZ '2026-10-21T00:00:00Z'
  WHERE offer_key = 'trial_28d_v1';

  SELECT launch_at, individual_launch_at
  INTO v_launch_before, v_individual_before
  FROM public.trial_offer_settings WHERE offer_key = 'trial_28d_v1';

  v_result := public.admin_set_trial_offer_enabled(
    true,
    '00000000-0000-4000-8000-0000000004a1',
    'religar oferta no teste M1',
    '00000000-0000-4000-8000-0000000000a8'
  );

  IF (v_result->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: religar a chave falhou (%)', v_result;
  END IF;

  SELECT launch_at, individual_launch_at
  INTO v_launch_after, v_individual_after
  FROM public.trial_offer_settings WHERE offer_key = 'trial_28d_v1';

  IF v_launch_after IS DISTINCT FROM v_launch_before THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: religar alterou launch_at';
  END IF;

  IF v_individual_after IS DISTINCT FROM v_individual_before THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: religar alterou individual_launch_at';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 12. Snapshot final: toggle e reativacao nao tocaram estado financeiro/parcelas
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_after_activation TEXT;
  v_after_toggle TEXT;
BEGIN
  INSERT INTO f50_4_m1_snapshots (label, value)
  SELECT 'after_toggle', jsonb_build_object(
    'balances', (SELECT jsonb_build_object(
        'count', count(*),
        'sum_balance', COALESCE(sum(balance), 0),
        'sum_bonus', COALESCE(sum(bonus_balance), 0),
        'sum_purchased', COALESCE(sum(purchased_balance), 0))
      FROM public.credit_balances),
    'transactions', (SELECT jsonb_build_object(
        'count', count(*),
        'sum_amount', COALESCE(sum(amount), 0),
        'checksum', COALESCE(md5(string_agg(id::text || ':' || amount::text, ',' ORDER BY id)), 'empty'))
      FROM public.credit_transactions),
    'entitlements', (SELECT jsonb_build_object(
        'count', count(*),
        'checksum', COALESCE(md5(string_agg(id::text || ':' || benefit_type, ',' ORDER BY id)), 'empty'))
      FROM public.freemium_entitlements),
    'enrollments', (SELECT jsonb_build_object(
        'count', count(*),
        'sum_granted_total', COALESCE(sum(granted_total), 0),
        'max_last_granted_seq', COALESCE(max(last_granted_seq), -1),
        'min_expires_at', COALESCE(min(expires_at)::text, 'none'))
      FROM public.trial_offer_enrollments)
  )::text;

  SELECT value INTO v_after_activation FROM f50_4_m1_snapshots WHERE label = 'after_activation';
  SELECT value INTO v_after_toggle FROM f50_4_m1_snapshots WHERE label = 'after_toggle';

  IF v_after_activation IS DISTINCT FROM v_after_toggle THEN
    RAISE EXCEPTION 'F50_4_M1_ASSERT: toggle da chave alterou estado financeiro/enrollments. after_activation=% after_toggle=%', v_after_activation, v_after_toggle;
  END IF;
END;
$$;

ROLLBACK;
