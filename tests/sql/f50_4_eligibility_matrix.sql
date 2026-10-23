-- =============================================================================
-- F50.4 — Matriz de elegibilidade por coorte (Migration M2)
-- Arquivo: tests/sql/f50_4_eligibility_matrix.sql
--
-- Executar em PostgreSQL descartável (plano 50.4-08), com M1+M2 aplicadas.
-- Script único, transacional, com ROLLBACK no final: nada persiste.
--
-- Cobre:
--   1. Matriz/filiais da mesma raiz elegíveis independentemente.
--   2. root_legacy bloqueado SOMENTE por enrollment root_legacy da raiz.
--   3. Enrollment per_cnpj_f50_4 de outra filial não bloqueia a conta legada.
--   4. Dois CNPJs distintos da mesma raiz: entitlement na filial A bloqueia a
--      conta legada (via trial_offer_legacy_root_prior_benefit/prior_benefit)
--      e NÃO bloqueia uma loja per_cnpj_f50_4 de outro CNPJ.
--   5. existing_enrollment_id somente da própria loja.
--   6. Inscrição da própria loja (existing) sem criar novo enrollment.
--   7. Coorte decidida por auth.users.created_at (onboarding tardio preserva).
--   8. Recusas: is_test_store, root_hash vazio, janela vencida, conta antiga.
--   9. prior_benefit_ambiguous fail-closed por entitlement órfão.
--  10. CNPJ numérico e alfanumérico.
--  11. Respostas sanitizadas (sem CNPJ completo/root_hash).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
UPDATE public.trial_offer_settings
SET enabled = true,
    launch_at = TIMESTAMPTZ '2026-10-01T00:00:00Z',
    individual_launch_at = TIMESTAMPTZ '2026-10-15T00:00:00Z'
WHERE offer_key = 'trial_28d_v1';

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000004b1', 'authenticated', 'authenticated',
   'f50-4-matrix-legacy@test.local', '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000004b2', 'authenticated', 'authenticated',
   'f50-4-matrix-legacy2@test.local', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000004b3', 'authenticated', 'authenticated',
   'f50-4-matrix-late@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000004b4', 'authenticated', 'authenticated',
   'f50-4-matrix-old@test.local', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10001', 'authenticated', 'authenticated',
   'f50-4-matrix-store-1@test.local', '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10002', 'authenticated', 'authenticated',
   'f50-4-matrix-store-2@test.local', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10003', 'authenticated', 'authenticated',
   'f50-4-matrix-store-3@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10004', 'authenticated', 'authenticated',
   'f50-4-matrix-store-4@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10005', 'authenticated', 'authenticated',
   'f50-4-matrix-store-5@test.local', '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10006', 'authenticated', 'authenticated',
   'f50-4-matrix-store-6@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10007', 'authenticated', 'authenticated',
   'f50-4-matrix-store-7@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10008', 'authenticated', 'authenticated',
   'f50-4-matrix-store-8@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10009', 'authenticated', 'authenticated',
   'f50-4-matrix-store-9@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10010', 'authenticated', 'authenticated',
   'f50-4-matrix-store-10@test.local', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10011', 'authenticated', 'authenticated',
   'f50-4-matrix-store-11@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10012', 'authenticated', 'authenticated',
   'f50-4-matrix-store-12@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10013', 'authenticated', 'authenticated',
   'f50-4-matrix-store-13@test.local', '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10014', 'authenticated', 'authenticated',
   'f50-4-matrix-store-14@test.local', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10015', 'authenticated', 'authenticated',
   'f50-4-matrix-store-15@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10016', 'authenticated', 'authenticated',
   'f50-4-matrix-store-16@test.local', '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z'),
  ('00000000-0000-4000-8000-000000b10017', 'authenticated', 'authenticated',
   'f50-4-matrix-store-17@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z');

INSERT INTO public.stores (
  id, name, segment, user_id, cnpj_normalized, cnpj_root_hash,
  onboarding_completed_at, is_test_store
) VALUES
  ('00000000-0000-4000-8000-000000005c01', 'matrix-a', 'outros',
   '00000000-0000-4000-8000-000000b10001', '11222333000181', 'root-num',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c02', 'matrix-b', 'outros',
   '00000000-0000-4000-8000-000000b10002', '11222333000262', 'root-num',
   '2026-10-18T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c03', 'matrix-c', 'outros',
   '00000000-0000-4000-8000-000000b10003', '11222333000343', 'root-num',
   '2026-10-21T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c11', 'matrix-c2', 'outros',
   '00000000-0000-4000-8000-000000b10004', '11222333000777', 'root-num',
   '2026-10-21T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c04', 'matrix-y1', 'outros',
   '00000000-0000-4000-8000-000000b10005', '77888999000111', 'root-y',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c05', 'matrix-y2', 'outros',
   '00000000-0000-4000-8000-000000b10006', '77888999000222', 'root-y',
   '2026-10-21T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c06', 'matrix-amb', 'outros',
   '00000000-0000-4000-8000-000000b10007', '99888777000199', 'root-amb',
   '2026-10-21T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c07', 'matrix-test', 'outros',
   '00000000-0000-4000-8000-000000b10008', '99888777000200', 'root-amb',
   '2026-10-21T00:00:00Z', true),
  ('00000000-0000-4000-8000-000000005c08', 'matrix-draft', 'outros',
   '00000000-0000-4000-8000-000000b10009', NULL, '',
   '2026-10-21T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c09', 'matrix-old', 'outros',
   '00000000-0000-4000-8000-000000b10010', '66777888000150', 'root-old',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c0a', 'matrix-alnum', 'outros',
   '00000000-0000-4000-8000-000000b10011', '12ABC345000199', 'root-alnum',
   '2026-10-21T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c0b', 'matrix-exp', 'outros',
   '00000000-0000-4000-8000-000000b10012', '55666777000140', 'root-exp',
   '2026-09-01T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c0c', 'matrix-x1', 'outros',
   '00000000-0000-4000-8000-000000b10013', '44555666000110', 'root-x',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c0d', 'matrix-x2', 'outros',
   '00000000-0000-4000-8000-000000b10014', '44555666000200', 'root-x',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c0e', 'matrix-x3', 'outros',
   '00000000-0000-4000-8000-000000b10015', '44555666000391', 'root-x',
   '2026-10-21T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c0f', 'matrix-z1', 'outros',
   '00000000-0000-4000-8000-000000b10016', '33444555000160', 'root-z',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-000000005c10', 'matrix-z2', 'outros',
   '00000000-0000-4000-8000-000000b10017', '33444555000241', 'root-z',
   '2026-10-21T00:00:00Z', false);

-- Benefício legado na filial A (CNPJ 11222333000181 / raiz root-num).
INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason)
VALUES ('00000000-0000-4000-8000-000000005c01', 'root-num', 'onboarding', 'fixture matrix');

-- Entitlement órfão (store_id NULL) com raiz própria -> ambiguidade.
INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason)
VALUES (NULL, 'root-amb', 'onboarding', 'fixture orphan');

-- Inscrições de fixture.
INSERT INTO public.trial_offer_enrollments (
  id, store_id, user_id, root_hash, offer_key, started_at, expires_at,
  beneficiary_cnpj_normalized, policy_cohort
) VALUES
  -- filial per_cnpj da raiz root-y (não pode bloquear s_y1 legado)
  ('00000000-0000-4000-8000-0000000007f1',
   '00000000-0000-4000-8000-000000005c05',
   '00000000-0000-4000-8000-0000000004b3',
   'root-y', 'trial_28d_v1',
   '2026-10-21T00:00:00Z', '2026-11-18T00:00:00Z',
   '77888999000222', 'per_cnpj_f50_4'),
  -- root_legacy da raiz root-x (bloqueia s_x1, não s_x3)
  ('00000000-0000-4000-8000-0000000007f2',
   '00000000-0000-4000-8000-000000005c0d',
   '00000000-0000-4000-8000-0000000004b2',
   'root-x', 'trial_28d_v1',
   '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
   '44555666000200', 'root_legacy'),
  -- enrollment da própria z2 (snapshot = stores.cnpj_normalized)
  ('00000000-0000-4000-8000-0000000007f3',
   '00000000-0000-4000-8000-000000005c10',
   '00000000-0000-4000-8000-000000b10017',
   'root-z', 'trial_28d_v1',
   '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
   '33444555000241', 'per_cnpj_f50_4'),
  -- enrollment da própria s_c (existing)
  ('00000000-0000-4000-8000-0000000007f4',
   '00000000-0000-4000-8000-000000005c03',
   '00000000-0000-4000-8000-0000000004b3',
   'root-num', 'trial_28d_v1',
   '2026-10-21T00:00:00Z', '2026-11-18T00:00:00Z',
   '11222333000343', 'per_cnpj_f50_4');

-- -----------------------------------------------------------------------------
-- 1. Coorte por auth.users.created_at
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF public.trial_offer_policy_cohort('00000000-0000-4000-8000-0000000004b1') <> 'root_legacy' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: conta antes do marco deveria ser root_legacy';
  END IF;

  IF public.trial_offer_policy_cohort('00000000-0000-4000-8000-0000000004b3') <> 'per_cnpj_f50_4' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: conta em/a partir do marco deveria ser per_cnpj_f50_4';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Matriz/filiais elegíveis independentemente + existing somente da própria loja
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_c2 JSONB;
  v_alnum JSONB;
  v_c JSONB;
  v_other_id UUID;
BEGIN
  v_c2 := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c11',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v_c2 ->> 'eligible')::boolean IS NOT TRUE
     OR (v_c2 ->> 'policy_cohort') <> 'per_cnpj_f50_4' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: filial per_cnpj independente deveria ser elegivel (%)', v_c2;
  END IF;

  IF v_c2 ->> 'existing_enrollment_id' IS NOT NULL THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: filial sem enrollment recebeu existing (%)', v_c2;
  END IF;

  v_alnum := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c0a',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v_alnum ->> 'eligible')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: CNPJ alfanumerico deveria ser elegivel (%)', v_alnum;
  END IF;

  v_c := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c03',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v_c ->> 'eligible')::boolean IS NOT TRUE
     OR (v_c ->> 'existing_enrollment_id')::uuid IS DISTINCT FROM
        '00000000-0000-4000-8000-0000000007f4'::uuid THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: existing da propria loja incorreto (%)', v_c;
  END IF;

  -- A resposta de outra filial nunca contém o ID da s_c.
  SELECT (v_c2 ->> 'existing_enrollment_id')::uuid INTO v_other_id;
  IF v_other_id = '00000000-0000-4000-8000-0000000007f4'::uuid THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: vazamento de existing_enrollment_id entre filiais';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. root_legacy bloqueado somente por enrollment root_legacy da raiz
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v JSONB;
BEGIN
  v := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c0c',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v ->> 'eligible')::boolean IS NOT FALSE
     OR (v ->> 'reason') <> 'root_used_other_beneficiary' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: legado deveria ser bloqueado por outra filial root_legacy (%)', v;
  END IF;

  IF v ->> 'existing_enrollment_id' IS NOT NULL THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: conflito de raiz vazou enrollment alheio (%)', v;
  END IF;

  -- A mesma raiz em per_cnpj_f50_4 (CNPJ distinto) permanece elegível.
  v := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c0e',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v ->> 'eligible')::boolean IS NOT TRUE
     OR (v ->> 'policy_cohort') <> 'per_cnpj_f50_4' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: per_cnpj nao deveria ser bloqueado pelo root_legacy da raiz (%)', v;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Enrollment per_cnpj de outra filial NÃO bloqueia a conta legada
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v JSONB;
BEGIN
  v := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c04',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v ->> 'eligible')::boolean IS NOT TRUE
     OR (v ->> 'policy_cohort') <> 'root_legacy' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: filial per_cnpj bloqueou indevidamente a conta legada (%)', v;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Dois CNPJs distintos da mesma raiz: legacy bloqueia, per_cnpj não
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_legacy JSONB;
  v_new_cohort JSONB;
  v_ctx_new JSONB;
  v_ctx_legacy JSONB;
BEGIN
  IF public.trial_offer_legacy_root_prior_benefit('root-num') IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: trial_offer_legacy_root_prior_benefit deveria ver o beneficio da raiz';
  END IF;

  -- Conta root_legacy (CNPJ B) é bloqueada por prior_benefit da filial A.
  v_legacy := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c02',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v_legacy ->> 'eligible')::boolean IS NOT FALSE
     OR (v_legacy ->> 'reason') <> 'prior_benefit' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: conta legada deveria ver prior_benefit pela raiz (%)', v_legacy;
  END IF;

  -- A mesma filial A NÃO bloqueia uma loja per_cnpj_f50_4 de outro CNPJ.
  v_new_cohort := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c11',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v_new_cohort ->> 'eligible')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: entitlement da filial A bloqueou per_cnpj de CNPJ distinto (%)', v_new_cohort;
  END IF;

  v_ctx_new := public.trial_offer_policy_context(
    '00000000-0000-4000-8000-0000000004b3',
    '11222333000777',
    'root-num'
  );
  IF (v_ctx_new ->> 'beneficiary_eligible')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: policy_context per_cnpj deveria ser elegivel (%)', v_ctx_new;
  END IF;

  v_ctx_legacy := public.trial_offer_policy_context(
    '00000000-0000-4000-8000-0000000004b2',
    '11222333000262',
    'root-num'
  );
  IF (v_ctx_legacy ->> 'root_eligible')::boolean IS NOT FALSE
     OR (v_ctx_legacy ->> 'policy_cohort') <> 'root_legacy' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: policy_context legado deveria refletir beneficio da raiz (%)', v_ctx_legacy;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Inscrição da própria loja: existing, sem novo enrollment
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v JSONB;
  v_start JSONB;
  v_count BIGINT;
BEGIN
  v := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c10',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v ->> 'eligible')::boolean IS NOT TRUE
     OR (v ->> 'existing_enrollment_id')::uuid IS DISTINCT FROM
        '00000000-0000-4000-8000-0000000007f3'::uuid THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: inscricao da propria loja deveria retornar existing (%)', v;
  END IF;

  IF v ? 'beneficiary_cnpj_normalized' OR v ? 'root_hash' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: resposta da propria loja vazou CNPJ/root_hash (%)', v;
  END IF;

  v_start := public.start_trial_offer_enrollment(
    '00000000-0000-4000-8000-000000005c10',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v_start ->> 'status') <> 'existing'
     OR (v_start ->> 'enrollment_id')::uuid IS DISTINCT FROM
        '00000000-0000-4000-8000-0000000007f3'::uuid THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: inscricao da propria loja deveria retornar existing (%)', v_start;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.trial_offer_enrollments
  WHERE store_id = '00000000-0000-4000-8000-000000005c10';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: replay da propria loja criou novo enrollment (count=%)', v_count;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Onboarding tardio preserva a coorte
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v JSONB;
BEGIN
  -- u_legacy2 foi criado antes do marco; onboarding concluído depois.
  v := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c02',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v ->> 'policy_cohort') <> 'root_legacy' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: onboarding tardio alterou a coorte legada (%)', v;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Recusas: test store, root vazio, janela vencida, conta antes do launch
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v JSONB;
BEGIN
  v := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c07',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v ->> 'reason') <> 'test_store' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: test store deveria ser recusada (%)', v;
  END IF;

  v := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c08',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v ->> 'reason') <> 'no_root' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: root_hash vazio deveria ser recusado (%)', v;
  END IF;

  v := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c0b',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v ->> 'reason') <> 'expired_window' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: janela vencida deveria ser recusada (%)', v;
  END IF;

  v := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c09',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v ->> 'reason') <> 'account_before_launch' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: conta anterior ao launch deveria ser recusada (%)', v;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. prior_benefit_ambiguous fail-closed + resposta sanitizada
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v JSONB;
  v_ctx JSONB;
  v_keys TEXT[];
BEGIN
  v := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-000000005c06',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v ->> 'reason') <> 'prior_benefit_ambiguous' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: entitlement orfao deveria gerar prior_benefit_ambiguous (%)', v;
  END IF;

  v_ctx := public.trial_offer_policy_context(
    '00000000-0000-4000-8000-0000000004b3',
    '99888777000199',
    'root-amb'
  );
  IF (v_ctx ->> 'beneficiary_ambiguous')::boolean IS NOT TRUE
     OR (v_ctx ->> 'beneficiary_eligible')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: policy_context deveria ser fail-closed na ambiguidade (%)', v_ctx;
  END IF;

  IF v_ctx ? 'beneficiary_cnpj_normalized' OR v_ctx ? 'root_hash' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: policy_context expoe CNPJ/root_hash (%)', v_ctx;
  END IF;

  SELECT array_agg(obj.key ORDER BY obj.key) INTO v_keys
  FROM jsonb_object_keys(v_ctx) AS obj(key);
  IF v_keys IS DISTINCT FROM ARRAY[
    'beneficiary_ambiguous',
    'beneficiary_eligible',
    'policy_cohort',
    'root_eligible'
  ] THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: policy_context deveria retornar exatamente quatro chaves (%)', v_keys;
  END IF;

  IF v ? 'root_hash' OR v ? 'beneficiary_cnpj_normalized' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: eligibility expoe CNPJ/root_hash (%)', v;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. Inscrição real: CNPJ alfanumérico e coexistência legado/per_cnpj
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_start JSONB;
  v_row RECORD;
  v_legacy_start JSONB;
  v_root_legacy_count BIGINT;
  v_per_cnpj_count BIGINT;
BEGIN
  v_start := public.start_trial_offer_enrollment(
    '00000000-0000-4000-8000-000000005c0a',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v_start ->> 'status') <> 'started' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: inscricao alfanumerica deveria iniciar (%)', v_start;
  END IF;

  SELECT beneficiary_cnpj_normalized, policy_cohort INTO v_row
  FROM public.trial_offer_enrollments
  WHERE store_id = '00000000-0000-4000-8000-000000005c0a';

  IF v_row.beneficiary_cnpj_normalized <> '12ABC345000199'
     OR v_row.policy_cohort <> 'per_cnpj_f50_4' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: identidade/coorte da inscricao alfanumerica incorreta';
  END IF;

  -- Conta legada da raiz root-y inscreve mesmo com per_cnpj da mesma raiz.
  v_legacy_start := public.start_trial_offer_enrollment(
    '00000000-0000-4000-8000-000000005c04',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v_legacy_start ->> 'status') <> 'started' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: conta legada deveria inscrever (%)', v_legacy_start;
  END IF;

  SELECT count(*) INTO v_root_legacy_count
  FROM public.trial_offer_enrollments
  WHERE root_hash = 'root-y' AND policy_cohort = 'root_legacy';

  SELECT count(*) INTO v_per_cnpj_count
  FROM public.trial_offer_enrollments
  WHERE root_hash = 'root-y' AND policy_cohort = 'per_cnpj_f50_4';

  IF v_root_legacy_count <> 1 OR v_per_cnpj_count <> 1 THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: coortes nao coexistiram na mesma raiz (legacy=%, per_cnpj=%)',
      v_root_legacy_count, v_per_cnpj_count;
  END IF;

  -- Replay idempotente da própria loja.
  v_start := public.start_trial_offer_enrollment(
    '00000000-0000-4000-8000-000000005c04',
    TIMESTAMPTZ '2026-10-21T12:00:00Z'
  );
  IF (v_start ->> 'status') <> 'existing' THEN
    RAISE EXCEPTION 'F50_4_MATRIX_ASSERT: replay da propria loja deveria retornar existing (%)', v_start;
  END IF;
END;
$$;

ROLLBACK;
