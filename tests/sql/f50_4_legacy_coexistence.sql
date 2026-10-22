-- =============================================================================
-- F50.4 — Coexistência demo/mensal legados (Migration M3)
-- Arquivo: tests/sql/f50_4_legacy_coexistence.sql
--
-- Executar em PostgreSQL DESCARTÁVEL (plano 50.4-08), com M1+M2+M3 aplicadas.
-- Script único, transacional, com ROLLBACK no final: nada persiste.
-- Timestamps explícitos: a coorte depende de auth.users.created_at.
--
-- Cobre:
--   1. Demo legada 10/168 para conta anterior ao launch_at.
--   2. `trial_offer_applies` para conta criada em/a partir do launch_at.
--   3. `trial_offer_consumed` somente por enrollment root_legacy/mesmo CNPJ.
--   4. Filial per_cnpj_f50_4 não retira a demo da conta anterior.
--   5. Mensal pula raiz com enrollment root_legacy (mesmo vencido).
--   6. Filial F50.4 não reduz o mensal da matriz legada.
--   7. Loja nova nunca recebe `bonus_monthly`; `skipped_new_policy_store`.
--   8. Configuração da oferta intacta.
--   9. Recipiente determinístico (matriz preferida) independente da ordem de
--      chegada das lojas.
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
  ('00000000-0000-4000-8000-00000000a401', 'authenticated', 'authenticated',
   'f50-4-coexist-legacy@test.local', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z'),
  ('00000000-0000-4000-8000-00000000a402', 'authenticated', 'authenticated',
   'f50-4-coexist-new@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z');

INSERT INTO public.stores (
  id, name, segment, user_id, cnpj_normalized, cnpj_root_hash,
  onboarding_completed_at, created_at, is_test_store
) VALUES
  -- Demo legada (conta pré launch_at) + filial nova da mesma raiz.
  ('00000000-0000-4000-8000-00000000b401', 'coexist-demo-legacy', 'outros',
   '00000000-0000-4000-8000-00000000a401', '11222333000181', 'root-demo-legacy',
   '2026-10-10T00:00:00Z', '2025-01-15T12:00:00Z', false),
  ('00000000-0000-4000-8000-00000000b402', 'coexist-demo-branch', 'outros',
   '00000000-0000-4000-8000-00000000a402', '11222333000343', 'root-demo-legacy',
   '2026-10-20T00:00:00Z', '2026-10-20T12:00:00Z', false),
  -- Conta pós launch_at -> demo nunca aplica.
  ('00000000-0000-4000-8000-00000000b403', 'coexist-after-launch', 'outros',
   '00000000-0000-4000-8000-00000000a402', '11222333000262', 'root-after-launch',
   '2026-10-20T00:00:00Z', '2025-02-15T12:00:00Z', false),
  -- Raiz com enrollment root_legacy -> demo consumida.
  ('00000000-0000-4000-8000-00000000b404', 'coexist-consumed', 'outros',
   '00000000-0000-4000-8000-00000000a401', '99888777000199', 'root-consumed',
   '2026-10-10T00:00:00Z', '2025-03-15T12:00:00Z', false),
  -- Barreira por mesmo CNPJ (enrollment de outro CNPJ na MESMA raiz não bloqueia).
  ('00000000-0000-4000-8000-00000000b405', 'coexist-cnpj-barrier', 'outros',
   '00000000-0000-4000-8000-00000000a401', '44555666000110', 'root-cnpj-barrier',
   '2026-10-10T00:00:00Z', '2025-04-15T12:00:00Z', false),
  ('00000000-0000-4000-8000-00000000b406', 'coexist-cnpj-other', 'outros',
   '00000000-0000-4000-8000-00000000a402', '44555666000200', 'root-cnpj-other',
   '2026-10-20T00:00:00Z', '2026-10-20T12:00:00Z', false),
  -- Raiz mensal mista: matriz legada + filial nova F50.4.
  ('00000000-0000-4000-8000-00000000b407', 'coexist-monthly-legacy', 'outros',
   '00000000-0000-4000-8000-00000000a401', '55666777000140', 'root-monthly-mixed',
   '2026-10-10T00:00:00Z', '2025-03-10T12:00:00Z', false),
  ('00000000-0000-4000-8000-00000000b408', 'coexist-monthly-branch', 'outros',
   '00000000-0000-4000-8000-00000000a402', '55666777000221', 'root-monthly-mixed',
   '2026-10-20T00:00:00Z', '2026-10-20T12:00:00Z', false),
  -- Raiz apenas com loja nova F50.4.
  ('00000000-0000-4000-8000-00000000b409', 'coexist-monthly-newonly', 'outros',
   '00000000-0000-4000-8000-00000000a402', '77888999000111', 'root-monthly-newonly',
   '2026-10-20T00:00:00Z', '2025-04-05T12:00:00Z', false),
  -- Raiz com enrollment root_legacy (exclusão do mensal).
  ('00000000-0000-4000-8000-00000000b40a', 'coexist-monthly-enrolled', 'outros',
   '00000000-0000-4000-8000-00000000a401', '66777888000150', 'root-monthly-enrolled',
   '2026-10-10T00:00:00Z', '2025-05-20T12:00:00Z', false),
  -- Ordem de chegada: filial (não matriz) cadastrada antes da matriz.
  ('00000000-0000-4000-8000-00000000b40b', 'coexist-order-branch', 'outros',
   '00000000-0000-4000-8000-00000000a401', '33444555000241', 'root-order',
   '2026-10-10T00:00:00Z', '2024-01-06T12:00:00Z', false),
  ('00000000-0000-4000-8000-00000000b40c', 'coexist-order-matrix', 'outros',
   '00000000-0000-4000-8000-00000000a401', '33444555000160', 'root-order',
   '2026-10-10T00:00:00Z', '2025-06-06T12:00:00Z', false);

-- Histórico freemium das raízes mensais (entitlement de onboarding).
INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason)
VALUES
  ('00000000-0000-4000-8000-00000000b407', 'root-monthly-mixed', 'onboarding', 'fixture coexist'),
  ('00000000-0000-4000-8000-00000000b409', 'root-monthly-newonly', 'onboarding', 'fixture coexist'),
  ('00000000-0000-4000-8000-00000000b40a', 'root-monthly-enrolled', 'onboarding', 'fixture coexist'),
  ('00000000-0000-4000-8000-00000000b40b', 'root-order', 'onboarding', 'fixture coexist');

-- Enrollment da filial nova (per_cnpj) na raiz da demo legada.
INSERT INTO public.trial_offer_enrollments (
  id, store_id, user_id, root_hash, offer_key, started_at, expires_at,
  beneficiary_cnpj_normalized, policy_cohort
) VALUES
  ('00000000-0000-4000-8000-00000000c401',
   '00000000-0000-4000-8000-00000000b402', '00000000-0000-4000-8000-00000000a402',
   'root-demo-legacy', 'trial_28d_v1',
   '2026-10-20T00:00:00Z', '2026-11-17T00:00:00Z',
   '11222333000343', 'per_cnpj_f50_4'),
  -- Enrollment root_legacy (vencido) -> consome a demo e exclui a raiz mensal.
  ('00000000-0000-4000-8000-00000000c402',
   '00000000-0000-4000-8000-00000000b404', '00000000-0000-4000-8000-00000000a401',
   'root-consumed', 'trial_28d_v1',
   '2026-09-01T00:00:00Z', '2026-09-29T00:00:00Z',
   '99888777000199', 'root_legacy'),
  ('00000000-0000-4000-8000-00000000c403',
   '00000000-0000-4000-8000-00000000b40a', '00000000-0000-4000-8000-00000000a401',
   'root-monthly-enrolled', 'trial_28d_v1',
   '2026-09-01T00:00:00Z', '2026-09-29T00:00:00Z',
   '66777888000150', 'root_legacy'),
  -- Enrollment root_legacy de OUTRA loja, com o MESMO CNPJ do beneficiário b405.
  ('00000000-0000-4000-8000-00000000c404',
   '00000000-0000-4000-8000-00000000b406', '00000000-0000-4000-8000-00000000a402',
   'root-cnpj-other', 'trial_28d_v1',
   '2026-10-20T00:00:00Z', '2026-11-17T00:00:00Z',
   '44555666000110', 'root_legacy');

-- -----------------------------------------------------------------------------
-- 1. Demo legada 10/168 para conta anterior ao launch_at, apesar da filial
--    per_cnpj_f50_4 da mesma raiz.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_grant JSONB;
  v_demo_balance INTEGER;
  v_expires TIMESTAMPTZ;
  v_delta_hours NUMERIC;
BEGIN
  v_grant := public.grant_demo_credits(
    '00000000-0000-4000-8000-00000000b401', 'root-demo-legacy', 10, true, 168, NULL, NULL
  );

  IF (v_grant ->> 'granted')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: demo legada deveria ser concedida (%)', v_grant;
  END IF;

  SELECT cb.demo_balance, cb.demo_expires_at
  INTO v_demo_balance, v_expires
  FROM public.credit_balances cb
  WHERE cb.store_id = '00000000-0000-4000-8000-00000000b401';

  IF v_demo_balance <> 10 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: demo deveria ter 10 creditos (obtido %)', v_demo_balance;
  END IF;

  v_delta_hours := EXTRACT(EPOCH FROM (v_expires - now())) / 3600;

  IF v_delta_hours < 167 OR v_delta_hours > 169 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: TTL da demo deveria ser 168h (obtido %)', v_delta_hours;
  END IF;

  -- Filial per_cnpj_f50_4 não retira a demo da conta anterior.
  IF EXISTS (
    SELECT 1 FROM public.trial_offer_enrollments e
    WHERE e.store_id = '00000000-0000-4000-8000-00000000b402'
      AND e.policy_cohort = 'per_cnpj_f50_4'
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: fixture da filial per_cnpj ausente';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Conta criada em/a partir do launch_at -> `trial_offer_applies`.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_grant JSONB;
BEGIN
  v_grant := public.grant_demo_credits(
    '00000000-0000-4000-8000-00000000b403', 'root-after-launch', 10, true, 168, NULL, NULL
  );

  IF (v_grant ->> 'reason') <> 'trial_offer_applies' THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: conta pos-launch_at deveria retornar trial_offer_applies (%)', v_grant;
  END IF;

  IF (v_grant ->> 'granted')::boolean IS TRUE THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: conta pos-launch_at nao pode receber demo (%)', v_grant;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. `trial_offer_consumed` por enrollment root_legacy e por MESMO CNPJ.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_grant JSONB;
BEGIN
  v_grant := public.grant_demo_credits(
    '00000000-0000-4000-8000-00000000b404', 'root-consumed', 10, true, 168, NULL, NULL
  );

  IF (v_grant ->> 'reason') <> 'trial_offer_consumed' THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: enrollment root_legacy deveria consumir a demo (%)', v_grant;
  END IF;

  v_grant := public.grant_demo_credits(
    '00000000-0000-4000-8000-00000000b405', 'root-cnpj-barrier', 10, true, 168, NULL, NULL
  );

  IF (v_grant ->> 'reason') <> 'trial_offer_consumed' THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: mesmo CNPJ deveria consumir a demo (%)', v_grant;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4/5/6/7/9. Mensal: exclusão só root_legacy; filial nova nunca recipiente;
--            matriz legada preservada; skipped_new_policy_store; ordem simétrica.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_result JSONB;
  v_mixed_bonus INTEGER;
  v_branch_bonus INTEGER;
  v_newonly_bonus INTEGER;
  v_enrolled_bonus INTEGER;
  v_matrix_bonus INTEGER;
  v_order_branch_bonus INTEGER;
  v_settings RECORD;
BEGIN
  -- Ciclo 2026-11: aniversários múltiplos para exercitar todas as raízes.
  v_result := public.grant_monthly_credits(5, 1000, 30, DATE '2026-11-10');

  IF (v_result ->> 'granted')::int < 1 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: mensal deveria conceder a matriz legada (%)', v_result;
  END IF;

  SELECT cb.bonus_balance INTO v_mixed_bonus
  FROM public.credit_balances cb
  WHERE cb.store_id = '00000000-0000-4000-8000-00000000b407';

  IF COALESCE(v_mixed_bonus, 0) <> 5 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: matriz legada deveria receber mensal (obtido %)', v_mixed_bonus;
  END IF;

  SELECT cb.bonus_balance INTO v_branch_bonus
  FROM public.credit_balances cb
  WHERE cb.store_id = '00000000-0000-4000-8000-00000000b408';

  IF COALESCE(v_branch_bonus, 0) <> 0 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: filial per_cnpj nao pode receber bonus_monthly (obtido %)', v_branch_bonus;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.credit_transactions ct
    WHERE ct.store_id = '00000000-0000-4000-8000-00000000b408'
      AND ct.type = 'bonus_monthly'
  ) THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: filial per_cnpj possui transacao bonus_monthly';
  END IF;

  -- Raiz só com loja nova: nenhum grant e contador dedicado.
  IF COALESCE((v_result -> 'details' ->> 'skipped_new_policy_store')::int, 0) < 1 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: skipped_new_policy_store deveria contar a raiz nova (%)', v_result;
  END IF;

  SELECT cb.bonus_balance INTO v_newonly_bonus
  FROM public.credit_balances cb
  WHERE cb.store_id = '00000000-0000-4000-8000-00000000b409';

  IF COALESCE(v_newonly_bonus, 0) <> 0 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: loja nova nao pode receber mensal (obtido %)', v_newonly_bonus;
  END IF;

  -- Raiz com enrollment root_legacy: excluída do ciclo.
  IF COALESCE((v_result -> 'details' ->> 'skipped_trial_offer_cohort')::int, 0) < 1 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: raiz com enrollment root_legacy deveria ser excluida (%)', v_result;
  END IF;

  SELECT cb.bonus_balance INTO v_enrolled_bonus
  FROM public.credit_balances cb
  WHERE cb.store_id = '00000000-0000-4000-8000-00000000b40a';

  IF COALESCE(v_enrolled_bonus, 0) <> 0 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: raiz com enrollment root_legacy recebeu mensal (%)', v_enrolled_bonus;
  END IF;

  -- Ordem de chegada simétrica: matriz (0001) recebe mesmo cadastrada depois.
  v_result := public.grant_monthly_credits(5, 1000, 30, DATE '2026-11-06');

  SELECT cb.bonus_balance INTO v_matrix_bonus
  FROM public.credit_balances cb
  WHERE cb.store_id = '00000000-0000-4000-8000-00000000b40c';

  SELECT cb.bonus_balance INTO v_order_branch_bonus
  FROM public.credit_balances cb
  WHERE cb.store_id = '00000000-0000-4000-8000-00000000b40b';

  IF COALESCE(v_matrix_bonus, 0) <> 5 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: matriz deveria ser recipiente independente da ordem (obtido %)', v_matrix_bonus;
  END IF;

  IF COALESCE(v_order_branch_bonus, 0) <> 0 THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: filial nao-matriz nao pode receber mensal (obtido %)', v_order_branch_bonus;
  END IF;

  -- Configuração da oferta intacta.
  SELECT enabled, launch_at, individual_launch_at INTO v_settings
  FROM public.trial_offer_settings
  WHERE offer_key = 'trial_28d_v1';

  IF v_settings.enabled IS NOT TRUE
     OR v_settings.launch_at IS DISTINCT FROM TIMESTAMPTZ '2026-10-01T00:00:00Z'
     OR v_settings.individual_launch_at IS DISTINCT FROM TIMESTAMPTZ '2026-10-15T00:00:00Z' THEN
    RAISE EXCEPTION 'F50_4_COEXIST_ASSERT: configuracao da oferta foi alterada pela M3';
  END IF;
END;
$$;

ROLLBACK;
