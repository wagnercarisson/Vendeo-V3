-- =============================================================================
-- F50.4 — Procedimento de prova do fail-closed da Migration M2
-- Arquivo: tests/sql/f50_4_migration_failclosed.sql
--
-- NÃO é um teste de schema aplicado: é o procedimento executado no plano
-- 50.4-10, em PostgreSQL descartável, com as migrations aplicadas ATÉ F50.3
-- (M2 ainda NÃO aplicada).
--
-- Procedimento externo (obrigatório, executado pelo runner do plano 50.4-10):
--   1. Criar instância descartável e aplicar o histórico do repo até F50.3.
--   2. Executar ESTE arquivo para semear cada cenário e provar que a query de
--      precheck da M2 detecta exatamente o caso semeado (subtransações
--      independentes, sempre revertidas).
--   3. Tentar aplicar a M2 pelo CLI Supabase real (2.75.0). A aplicação DEVE
--      abortar com o código F50_4_PRECHECK_* correspondente ao cenário.
--   4. Conferir que a contagem/estado de stores e trial_offer_enrollments
--      permaneceu inalterada e que as colunas novas NÃO existem.
--   Nunca imprimir CNPJ completo, root_hash, ids de loja/usuário ou connection
--   string. As mensagens trazem apenas contagens.
--
-- Cenários (um por execução no procedimento externo; aqui todos em
-- subtransações isoladas):
--   A. F50_4_PRECHECK_MISSING_STORE       — enrollment sem loja existente
--   B. F50_4_PRECHECK_BAD_CNPJ            — loja sem CNPJ canônico
--   C. F50_4_PRECHECK_ROOT_HASH_MISMATCH  — root_hash divergente da loja
--
-- Se a M2 já estiver aplicada, o arquivo é inerte (apenas NOTICE) para não
-- quebrar o runner padrão de 50.4-08.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE f50_4_failclosed_baseline (
  label TEXT PRIMARY KEY,
  value BIGINT NOT NULL
) ON COMMIT DROP;

-- -----------------------------------------------------------------------------
-- 0. Baseline e guarda de M2 aplicada
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_applied BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trial_offer_enrollments'
      AND column_name = 'beneficiary_cnpj_normalized'
  ) INTO v_applied;

  IF v_applied THEN
    RAISE NOTICE
      'F50_4_FAILCLOSED: M2 ja aplicada neste banco; nenhum cenario executado. Use um alvo com migrations ate F50.3.';
    RETURN;
  END IF;

  INSERT INTO f50_4_failclosed_baseline (label, value)
  SELECT 'missing_store', count(*)
  FROM public.trial_offer_enrollments e
  LEFT JOIN public.stores s ON s.id = e.store_id
  WHERE s.id IS NULL;

  INSERT INTO f50_4_failclosed_baseline (label, value)
  SELECT 'bad_cnpj', count(*)
  FROM public.trial_offer_enrollments e
  JOIN public.stores s ON s.id = e.store_id
  WHERE s.cnpj_normalized IS NULL
     OR s.cnpj_normalized !~ '^[A-Z0-9]{12}[0-9]{2}$';

  INSERT INTO f50_4_failclosed_baseline (label, value)
  SELECT 'root_mismatch', count(*)
  FROM public.trial_offer_enrollments e
  JOIN public.stores s ON s.id = e.store_id
  WHERE s.cnpj_root_hash IS DISTINCT FROM e.root_hash
     OR s.cnpj_root_hash IS NULL
     OR s.cnpj_root_hash = '';

  INSERT INTO f50_4_failclosed_baseline (label, value)
  SELECT 'enrollments_total', count(*) FROM public.trial_offer_enrollments;

  INSERT INTO f50_4_failclosed_baseline (label, value)
  SELECT 'stores_total', count(*) FROM public.stores;
END;
$$;

-- -----------------------------------------------------------------------------
-- Cenário A — F50_4_PRECHECK_MISSING_STORE
-- Semeia enrollment válido e remove a loja com RI desabilitada (superuser),
-- reproduzindo o órfão que a M2 precisa recusar.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_baseline BIGINT;
  v_found BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trial_offer_enrollments'
      AND column_name = 'beneficiary_cnpj_normalized'
  ) THEN
    RETURN;
  END IF;

  SELECT value INTO v_baseline
  FROM f50_4_failclosed_baseline WHERE label = 'missing_store';

  BEGIN
    INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
    VALUES ('00000000-0000-4000-8000-0000000004e1', 'authenticated', 'authenticated',
            'f50-4-failclosed-a@test.local',
            '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z');

    INSERT INTO public.stores (
      id, name, segment, user_id, cnpj_normalized, cnpj_root_hash,
      onboarding_completed_at, is_test_store
    ) VALUES (
      '00000000-0000-4000-8000-0000000006e1', 'failclosed-a', 'outros',
      '00000000-0000-4000-8000-0000000004e1',
      '11222333000181', 'root-fail-a', '2026-10-10T00:00:00Z', false
    );

    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at
    ) VALUES (
      '00000000-0000-4000-8000-0000000006e1',
      '00000000-0000-4000-8000-0000000004e1',
      'root-fail-a', 'trial_28d_v1',
      '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z'
    );

    PERFORM set_config('session_replication_role', 'replica', true);
    DELETE FROM public.stores WHERE id = '00000000-0000-4000-8000-0000000006e1';
    PERFORM set_config('session_replication_role', 'origin', true);

    SELECT count(*) INTO v_found
    FROM public.trial_offer_enrollments e
    LEFT JOIN public.stores s ON s.id = e.store_id
    WHERE s.id IS NULL;

    IF v_found <> v_baseline + 1 THEN
      RAISE EXCEPTION
        'F50_4_FAILCLOSED_ASSERT: cenario A nao produziu um enrollment orfao (delta=%)',
        v_found - v_baseline;
    END IF;

    RAISE NOTICE 'F50_4_PRECHECK_MISSING_STORE: % enrollment(s) sem loja (esperado abortar).', v_found - v_baseline;

    RAISE EXCEPTION 'F50_4_SCENARIO_DONE_A';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'F50_4_SCENARIO_DONE_A' THEN
      RAISE;
    END IF;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- Cenário B — F50_4_PRECHECK_BAD_CNPJ
-- Loja draft (cnpj_normalized NULL / root vazio) com enrollment associado.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_baseline BIGINT;
  v_found BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trial_offer_enrollments'
      AND column_name = 'beneficiary_cnpj_normalized'
  ) THEN
    RETURN;
  END IF;

  SELECT value INTO v_baseline
  FROM f50_4_failclosed_baseline WHERE label = 'bad_cnpj';

  BEGIN
    INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
    VALUES ('00000000-0000-4000-8000-0000000004e2', 'authenticated', 'authenticated',
            'f50-4-failclosed-b@test.local',
            '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z');

    INSERT INTO public.stores (
      id, name, segment, user_id, cnpj_normalized, cnpj_root_hash,
      onboarding_completed_at, is_test_store
    ) VALUES (
      '00000000-0000-4000-8000-0000000006e2', 'failclosed-b', 'outros',
      '00000000-0000-4000-8000-0000000004e2',
      NULL, '', '2026-10-10T00:00:00Z', false
    );

    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at
    ) VALUES (
      '00000000-0000-4000-8000-0000000006e2',
      '00000000-0000-4000-8000-0000000004e2',
      '', 'trial_28d_v1',
      '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z'
    );

    SELECT count(*) INTO v_found
    FROM public.trial_offer_enrollments e
    JOIN public.stores s ON s.id = e.store_id
    WHERE s.cnpj_normalized IS NULL
       OR s.cnpj_normalized !~ '^[A-Z0-9]{12}[0-9]{2}$';

    IF v_found <> v_baseline + 1 THEN
      RAISE EXCEPTION
        'F50_4_FAILCLOSED_ASSERT: cenario B nao detectou CNPJ invalido (delta=%)',
        v_found - v_baseline;
    END IF;

    RAISE NOTICE 'F50_4_PRECHECK_BAD_CNPJ: % enrollment(s) sem CNPJ canonico (esperado abortar).', v_found - v_baseline;

    RAISE EXCEPTION 'F50_4_SCENARIO_DONE_B';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'F50_4_SCENARIO_DONE_B' THEN
      RAISE;
    END IF;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- Cenário C — F50_4_PRECHECK_ROOT_HASH_MISMATCH
-- Loja válida, enrollment com root_hash divergente.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_baseline BIGINT;
  v_found BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trial_offer_enrollments'
      AND column_name = 'beneficiary_cnpj_normalized'
  ) THEN
    RETURN;
  END IF;

  SELECT value INTO v_baseline
  FROM f50_4_failclosed_baseline WHERE label = 'root_mismatch';

  BEGIN
    INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
    VALUES ('00000000-0000-4000-8000-0000000004e3', 'authenticated', 'authenticated',
            'f50-4-failclosed-c@test.local',
            '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z');

    INSERT INTO public.stores (
      id, name, segment, user_id, cnpj_normalized, cnpj_root_hash,
      onboarding_completed_at, is_test_store
    ) VALUES (
      '00000000-0000-4000-8000-0000000006e3', 'failclosed-c', 'outros',
      '00000000-0000-4000-8000-0000000004e3',
      '11222333000262', 'root-fail-c-ok', '2026-10-10T00:00:00Z', false
    );

    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at
    ) VALUES (
      '00000000-0000-4000-8000-0000000006e3',
      '00000000-0000-4000-8000-0000000004e3',
      'root-fail-c-divergente', 'trial_28d_v1',
      '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z'
    );

    SELECT count(*) INTO v_found
    FROM public.trial_offer_enrollments e
    JOIN public.stores s ON s.id = e.store_id
    WHERE s.cnpj_root_hash IS DISTINCT FROM e.root_hash
       OR s.cnpj_root_hash IS NULL
       OR s.cnpj_root_hash = '';

    IF v_found <> v_baseline + 1 THEN
      RAISE EXCEPTION
        'F50_4_FAILCLOSED_ASSERT: cenario C nao detectou root_hash divergente (delta=%)',
        v_found - v_baseline;
    END IF;

    RAISE NOTICE 'F50_4_PRECHECK_ROOT_HASH_MISMATCH: % enrollment(s) com root_hash incompativel (esperado abortar).', v_found - v_baseline;

    RAISE EXCEPTION 'F50_4_SCENARIO_DONE_C';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'F50_4_SCENARIO_DONE_C' THEN
      RAISE;
    END IF;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- Preservação: as subtransações acima não deixaram rastro
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing BIGINT;
  v_bad BIGINT;
  v_mismatch BIGINT;
  v_enrollments BIGINT;
  v_stores BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trial_offer_enrollments'
      AND column_name = 'beneficiary_cnpj_normalized'
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_missing
  FROM public.trial_offer_enrollments e
  LEFT JOIN public.stores s ON s.id = e.store_id
  WHERE s.id IS NULL;

  SELECT count(*) INTO v_bad
  FROM public.trial_offer_enrollments e
  JOIN public.stores s ON s.id = e.store_id
  WHERE s.cnpj_normalized IS NULL
     OR s.cnpj_normalized !~ '^[A-Z0-9]{12}[0-9]{2}$';

  SELECT count(*) INTO v_mismatch
  FROM public.trial_offer_enrollments e
  JOIN public.stores s ON s.id = e.store_id
  WHERE s.cnpj_root_hash IS DISTINCT FROM e.root_hash
     OR s.cnpj_root_hash IS NULL
     OR s.cnpj_root_hash = '';

  SELECT count(*) INTO v_enrollments FROM public.trial_offer_enrollments;
  SELECT count(*) INTO v_stores FROM public.stores;

  IF v_missing <> (SELECT value FROM f50_4_failclosed_baseline WHERE label = 'missing_store')
     OR v_bad <> (SELECT value FROM f50_4_failclosed_baseline WHERE label = 'bad_cnpj')
     OR v_mismatch <> (SELECT value FROM f50_4_failclosed_baseline WHERE label = 'root_mismatch') THEN
    RAISE EXCEPTION 'F50_4_FAILCLOSED_ASSERT: deteccao de precheck alterou o estado do banco';
  END IF;

  IF v_enrollments <> (SELECT value FROM f50_4_failclosed_baseline WHERE label = 'enrollments_total')
     OR v_stores <> (SELECT value FROM f50_4_failclosed_baseline WHERE label = 'stores_total') THEN
    RAISE EXCEPTION 'F50_4_FAILCLOSED_ASSERT: contagem de stores/enrollments mudou durante os cenarios';
  END IF;

  RAISE NOTICE 'F50_4_FAILCLOSED_OK: cenarios revertidos; nenhuma linha persistiu.';
END;
$$;

ROLLBACK;
