-- =============================================================================
-- F50.4 — Crédito manual × exceção administrativa × texto livre (Migration M3)
-- Arquivo: tests/sql/f50_4_manual_credit.sql
--
-- Executar em PostgreSQL DESCARTÁVEL (plano 50.4-08), com M1+M2+M3 aplicadas.
-- Script único, transacional, com ROLLBACK no final: nada persiste.
--
-- Cobre:
--   1. `admin_grant` não cria/altera enrollment.
--   2. `admin_grant` não consome parcela e não muda granted_total,
--      last_granted_seq nem expires_at.
--   3. `admin_grant` com texto "onboarding" NÃO reclassifica nem bloqueia.
--   4. `admin_exception` bloqueia o MESMO CNPJ como benefício anterior.
--   5. Elegibilidade ignora `admin_grant`.
--   6. Leitura de benefício anterior nunca devolve CNPJ/root_hash/ids.
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
  ('00000000-0000-4000-8000-00000000d401', 'authenticated', 'authenticated',
   'f50-4-manual-legacy@test.local', '2026-09-25T00:00:00Z', '2026-09-25T00:00:00Z'),
  ('00000000-0000-4000-8000-00000000d402', 'authenticated', 'authenticated',
   'f50-4-manual-new@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z');

INSERT INTO public.stores (
  id, name, segment, user_id, cnpj_normalized, cnpj_root_hash,
  onboarding_completed_at, created_at, is_test_store
) VALUES
  ('00000000-0000-4000-8000-00000000e401', 'manual-enrollment', 'outros',
   '00000000-0000-4000-8000-00000000d401', '11222333000181', 'root-manual',
   '2026-10-10T00:00:00Z', '2025-01-10T12:00:00Z', false),
  ('00000000-0000-4000-8000-00000000e402', 'manual-exception', 'outros',
   '00000000-0000-4000-8000-00000000d401', '22333444000122', 'root-exception',
   '2026-10-10T00:00:00Z', '2025-02-10T12:00:00Z', false),
  ('00000000-0000-4000-8000-00000000e403', 'manual-free-text', 'outros',
   '00000000-0000-4000-8000-00000000d401', '33444555000160', 'root-text',
   '2026-10-10T00:00:00Z', '2025-03-10T12:00:00Z', false),
  ('00000000-0000-4000-8000-00000000e404', 'manual-eligibility', 'outros',
   '00000000-0000-4000-8000-00000000d402', '55666777000140', 'root-eligibility',
   '2026-10-21T00:00:00Z', '2025-04-10T12:00:00Z', false);

-- Enrollment congelado: o crédito manual não pode tocá-lo.
INSERT INTO public.trial_offer_enrollments (
  id, store_id, user_id, root_hash, offer_key, started_at, expires_at,
  granted_total, last_granted_seq, beneficiary_cnpj_normalized, policy_cohort
) VALUES
  ('00000000-0000-4000-8000-00000000f401',
   '00000000-0000-4000-8000-00000000e401', '00000000-0000-4000-8000-00000000d401',
   'root-manual', 'trial_28d_v1',
   '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
   4, 0, '11222333000181', 'root_legacy');

-- -----------------------------------------------------------------------------
-- 1/2/3. admin_grant não altera enrollment, não consome parcela e texto livre
--        não reclassifica.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_before RECORD;
  v_after RECORD;
  v_grant_result JSONB;
  v_enrollment_count INTEGER;
  v_context JSONB;
  v_tx_type TEXT;
  v_text_prior JSONB;
BEGIN
  SELECT granted_total, last_granted_seq, expires_at, store_id, user_id
  INTO v_before
  FROM public.trial_offer_enrollments
  WHERE id = '00000000-0000-4000-8000-00000000f401';

  v_grant_result := public.admin_grant_credits(
    '00000000-0000-4000-8000-00000000d401',
    '00000000-0000-4000-8000-00000000e401',
    3,
    'credito manual pontual',
    '00000000-0000-4000-8000-000000001001',
    '{}'::jsonb
  );

  IF v_grant_result ->> 'transaction_id' IS NULL THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: admin_grant deveria criar transacao (%)', v_grant_result;
  END IF;

  SELECT granted_total, last_granted_seq, expires_at, store_id, user_id
  INTO v_after
  FROM public.trial_offer_enrollments
  WHERE id = '00000000-0000-4000-8000-00000000f401';

  IF v_after.granted_total IS DISTINCT FROM v_before.granted_total
     OR v_after.last_granted_seq IS DISTINCT FROM v_before.last_granted_seq THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: admin_grant alterou granted_total/last_granted_seq (% -> %)',
      v_before, v_after;
  END IF;

  IF v_after.expires_at IS DISTINCT FROM v_before.expires_at THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: admin_grant alterou expires_at (% -> %)',
      v_before.expires_at, v_after.expires_at;
  END IF;

  SELECT count(*) INTO v_enrollment_count
  FROM public.trial_offer_enrollments
  WHERE store_id = '00000000-0000-4000-8000-00000000e401'
     OR beneficiary_cnpj_normalized = '11222333000181';

  IF v_enrollment_count <> 1 THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: admin_grant criou/removeu enrollment (total %)', v_enrollment_count;
  END IF;

  SELECT type INTO v_tx_type
  FROM public.credit_transactions
  WHERE store_id = '00000000-0000-4000-8000-00000000e401'
    AND id = (v_grant_result ->> 'transaction_id')::uuid;

  IF v_tx_type <> 'admin_grant' THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: admin_grant deveria gerar type=admin_grant (obtido %)', v_tx_type;
  END IF;

  -- Texto livre "onboarding" NÃO reclassifica: credita novamente e a leitura
  -- estruturada continua sem benefício anterior para esse CNPJ.
  PERFORM public.admin_grant_credits(
    '00000000-0000-4000-8000-00000000d401',
    '00000000-0000-4000-8000-00000000e403',
    2,
    'onboarding manual de cortesia',
    '00000000-0000-4000-8000-000000001002',
    '{}'::jsonb
  );

  v_text_prior := public.trial_offer_beneficiary_prior_benefit(
    '33444555000160', 'root-text'
  );

  IF COALESCE((v_text_prior ->> 'prior_benefit')::boolean, false) THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: texto livre "onboarding" reclassificou admin_grant (%)', v_text_prior;
  END IF;

  IF v_text_prior ? 'beneficiary_cnpj_normalized' OR v_text_prior ? 'root_hash' THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: leitura de benefício anterior vazou CNPJ/root_hash (%)', v_text_prior;
  END IF;

  v_context := public.trial_offer_policy_context(
    '00000000-0000-4000-8000-00000000d402',
    '33444555000160',
    'root-text'
  );

  IF v_context ->> 'policy_cohort' <> 'per_cnpj_f50_4' THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: conta nova deveria ser per_cnpj_f50_4 (%)', v_context;
  END IF;

  IF (v_context ->> 'beneficiary_eligible')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: admin_grant/texto livre nao pode bloquear a F50.4 (%)', v_context;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4/5. admin_exception bloqueia o mesmo CNPJ e não cria enrollment.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_exception JSONB;
  v_prior JSONB;
  v_context JSONB;
  v_entitlement RECORD;
  v_enrollment_count INTEGER;
BEGIN
  v_exception := public.admin_grant_freemium_exception(
    '00000000-0000-4000-8000-00000000e402',
    'excecao administrativa auditada',
    '00000000-0000-4000-8000-00000000d401'
  );

  IF (v_exception ->> 'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: admin_exception deveria ter sucesso (%)', v_exception;
  END IF;

  SELECT benefit_type, store_id INTO v_entitlement
  FROM public.freemium_entitlements
  WHERE id = (v_exception ->> 'entitlement_id')::uuid;

  IF v_entitlement.benefit_type <> 'admin_exception'
     OR v_entitlement.store_id IS DISTINCT FROM '00000000-0000-4000-8000-00000000e402' THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: entitlement de excecao incorreto (%)', v_entitlement;
  END IF;

  v_prior := public.trial_offer_beneficiary_prior_benefit('22333444000122', 'root-exception');
  IF COALESCE((v_prior ->> 'prior_benefit')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: admin_exception deveria bloquear o mesmo CNPJ (%)', v_prior;
  END IF;

  v_context := public.trial_offer_policy_context(
    '00000000-0000-4000-8000-00000000d402',
    '22333444000122',
    'root-exception'
  );

  IF (v_context ->> 'beneficiary_eligible')::boolean IS TRUE THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: beneficiario com admin_exception deveria ser inelegivel (%)', v_context;
  END IF;

  SELECT count(*) INTO v_enrollment_count
  FROM public.trial_offer_enrollments
  WHERE store_id = '00000000-0000-4000-8000-00000000e402'
     OR beneficiary_cnpj_normalized = '22333444000122';

  IF v_enrollment_count <> 0 THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: admin_exception criou enrollment (total %)', v_enrollment_count;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Elegibilidade ignora admin_grant.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_grant JSONB;
  v_eligibility JSONB;
BEGIN
  v_grant := public.admin_grant_credits(
    '00000000-0000-4000-8000-00000000d402',
    '00000000-0000-4000-8000-00000000e404',
    1,
    'onboarding (texto livre)',
    '00000000-0000-4000-8000-000000001003',
    '{}'::jsonb
  );

  IF v_grant ->> 'transaction_id' IS NULL THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: admin_grant na loja de elegibilidade falhou (%)', v_grant;
  END IF;

  v_eligibility := public.trial_offer_eligibility(
    '00000000-0000-4000-8000-00000000e404',
    TIMESTAMPTZ '2026-10-22T12:00:00Z'
  );

  IF (v_eligibility ->> 'eligible')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: elegibilidade nao pode ser bloqueada por admin_grant (%)', v_eligibility;
  END IF;

  IF v_eligibility ->> 'policy_cohort' <> 'per_cnpj_f50_4' THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: coorte da loja de elegibilidade incorreta (%)', v_eligibility;
  END IF;

  IF v_eligibility ? 'beneficiary_cnpj_normalized' OR v_eligibility ? 'root_hash' THEN
    RAISE EXCEPTION 'F50_4_MANUAL_ASSERT: elegibilidade vazou CNPJ/root_hash (%)', v_eligibility;
  END IF;
END;
$$;

ROLLBACK;
