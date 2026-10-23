-- F50.4 — Evidência do UAT: regressão do mensal por raiz
-- Executa em transação e faz ROLLBACK (nenhum dado permanece).
BEGIN;

-- Isola o teste: apenas as raízes criadas abaixo participam do loop.
UPDATE public.stores
SET is_test_store = true
WHERE cnpj_root_hash NOT IN ('uat-monthly-root-A', 'uat-monthly-root-B', 'uat-monthly-root-C');

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'uat-monthly-a@uat.local', '2026-10-21T12:00:00Z', now()),
  ('b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'uat-monthly-b1@uat.local', '2026-10-21T12:00:00Z', now()),
  ('b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'uat-monthly-b2@uat.local', '2026-10-22T23:30:00Z', now()),
  ('c0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'uat-monthly-c1@uat.local', '2026-10-22T23:30:00Z', now());

INSERT INTO public.stores (name, segment, user_id, cnpj_normalized, cnpj_root_hash, is_test_store, created_at)
VALUES
  ('UAT Monthly A', 'outros', 'a0000000-0000-4000-8000-000000000001', '99000000000191', 'uat-monthly-root-A', false, '2026-10-21T12:00:00Z'),
  ('UAT Monthly B Matriz', 'outros', 'b0000000-0000-4000-8000-000000000001', '99000000000272', 'uat-monthly-root-B', false, '2026-10-21T12:00:00Z'),
  ('UAT Monthly B Filial', 'outros', 'b0000000-0000-4000-8000-000000000002', '99000000000353', 'uat-monthly-root-B', false, '2026-10-22T23:30:00Z'),
  ('UAT Monthly C Nova', 'outros', 'c0000000-0000-4000-8000-000000000001', '99000000000434', 'uat-monthly-root-C', false, '2026-10-22T23:30:00Z');

-- Root A: enrollment legado -> raiz deve ser pulada.
INSERT INTO public.trial_offer_enrollments
  (store_id, user_id, root_hash, offer_key, started_at, expires_at, beneficiary_cnpj_normalized, policy_cohort)
SELECT s.id, s.user_id, s.cnpj_root_hash, 'trial_28d_v1', '2026-10-21T12:00:00Z', '2026-11-18T12:00:00Z', s.cnpj_normalized, 'root_legacy'
FROM public.stores s WHERE s.cnpj_root_hash = 'uat-monthly-root-A';

-- Root B: matriz legada com histórico de onboarding + filial F50.4.
INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type)
SELECT s.id, s.cnpj_root_hash, 'onboarding'
FROM public.stores s WHERE s.name = 'UAT Monthly B Matriz';

INSERT INTO public.trial_offer_enrollments
  (store_id, user_id, root_hash, offer_key, started_at, expires_at, beneficiary_cnpj_normalized, policy_cohort)
SELECT s.id, s.user_id, s.cnpj_root_hash, 'trial_28d_v1', '2026-10-22T23:30:00Z', '2026-11-19T23:30:00Z', s.cnpj_normalized, 'per_cnpj_f50_4'
FROM public.stores s WHERE s.name = 'UAT Monthly B Filial';

DO $$
DECLARE
  v_result JSONB;
  v_count INTEGER;
BEGIN
  v_result := public.grant_monthly_credits(5, 10, 0, DATE '2026-11-21');

  -- Root A: sem grant.
  SELECT count(*) INTO v_count
  FROM public.credit_transactions ct
  JOIN public.stores s ON s.id = ct.store_id
  WHERE s.cnpj_root_hash = 'uat-monthly-root-A' AND ct.type = 'bonus_monthly';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'root A recebeu bonus_monthly inesperado: %', v_count;
  END IF;

  -- Root B: exatamente um grant na matriz.
  SELECT count(*) INTO v_count
  FROM public.credit_transactions ct
  JOIN public.stores s ON s.id = ct.store_id
  WHERE s.cnpj_root_hash = 'uat-monthly-root-B' AND ct.type = 'bonus_monthly';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'root B deveria ter 1 bonus_monthly, obteve %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.credit_transactions ct
  JOIN public.stores s ON s.id = ct.store_id
  WHERE s.name = 'UAT Monthly B Matriz' AND ct.type = 'bonus_monthly';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'matriz B deveria ser a recipiente, obteve %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.freemium_entitlements fe
  JOIN public.stores s ON s.id = fe.store_id
  WHERE s.name = 'UAT Monthly B Matriz' AND fe.benefit_type = 'monthly' AND fe.cycle = '2026-11';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'entitlement monthly da matriz B ausente: %', v_count;
  END IF;

  -- Root C: nenhum grant e nenhum entitlement.
  SELECT count(*) INTO v_count
  FROM public.credit_transactions ct
  JOIN public.stores s ON s.id = ct.store_id
  WHERE s.cnpj_root_hash = 'uat-monthly-root-C' AND ct.type = 'bonus_monthly';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'root C recebeu bonus_monthly inesperado: %', v_count;
  END IF;

  -- Resultado agregado do cron para as três raízes.
  IF (v_result->'details'->>'skipped_trial_offer_cohort')::int < 1 THEN
    RAISE EXCEPTION 'skipped_trial_offer_cohort não registrou a raiz legada: %', v_result;
  END IF;
  IF (v_result->'details'->>'skipped_new_policy_store')::int < 1 THEN
    RAISE EXCEPTION 'skipped_new_policy_store não registrou a raiz só F50.4: %', v_result;
  END IF;

  RAISE NOTICE 'MONTHLY_REGRESSION_PASS %', v_result;
END $$;

ROLLBACK;
