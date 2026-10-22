-- =============================================================================
-- F50.4 — Prova SQL da Migration M2 (identidade e unicidade)
-- Arquivo: tests/sql/f50_4_m2_identity.sql
--
-- Executar em PostgreSQL descartável (plano 50.4-08), com M1+M2 aplicadas.
-- Script único, transacional, com ROLLBACK no final: nada persiste.
--
-- Cobre:
--   1. Backfill/identidade: beneficiary_cnpj_normalized é NOT NULL e igual ao
--      CNPJ canônico da loja beneficiária.
--   2. policy_cohort default root_legacy para o legado.
--   3. Duas filiais per_cnpj_f50_4 da mesma raiz coexistem.
--   4. Segundo root_legacy da mesma raiz falha (índice parcial).
--   5. Mesmo CNPJ completo nunca se repete (unicidade global).
--   6. Trigger recusa os sete campos imutáveis e permite granted_total/
--      last_granted_seq.
--   7. CHECK rejeita CNPJ fora de ^[A-Z0-9]{12}[0-9]{2}$ e coorte inválida.
--   8. CNPJ numérico e alfanumérico canônicos são aceitos.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000004c1', 'authenticated', 'authenticated',
   'f50-4-m2-u1@test.local', '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000004c2', 'authenticated', 'authenticated',
   'f50-4-m2-u2@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z');

INSERT INTO public.stores (
  id, name, segment, user_id, cnpj_normalized, cnpj_root_hash,
  onboarding_completed_at, is_test_store
) VALUES
  ('00000000-0000-4000-8000-0000000006d1', 'm2-store-1', 'outros',
   '00000000-0000-4000-8000-0000000004c1', '11222333000181', 'root-id',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-0000000006d2', 'm2-store-2', 'outros',
   '00000000-0000-4000-8000-0000000004c1', '11222333000262', 'root-id',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-0000000006d3', 'm2-store-3', 'outros',
   '00000000-0000-4000-8000-0000000004c2', '12ABC345000199', 'root-id-alnum',
   '2026-10-21T00:00:00Z', false),
  ('00000000-0000-4000-8000-0000000006d4', 'm2-store-4', 'outros',
   '00000000-0000-4000-8000-0000000004c2', '11222333000343', 'root-id',
   '2026-10-21T00:00:00Z', false),
  ('00000000-0000-4000-8000-0000000006d5', 'm2-store-5', 'outros',
   '00000000-0000-4000-8000-0000000004c1', '55666777000140', 'root-id-5',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-0000000006d6', 'm2-store-6', 'outros',
   '00000000-0000-4000-8000-0000000004c1', '11222333000424', 'root-id',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-0000000006d7', 'm2-store-7', 'outros',
   '00000000-0000-4000-8000-0000000004c1', '11222333000505', 'root-id-7',
   '2026-10-10T00:00:00Z', false),
  ('00000000-0000-4000-8000-0000000006d8', 'm2-store-8', 'outros',
   '00000000-0000-4000-8000-0000000004c1', '11222333000696', 'root-id-8',
   '2026-10-10T00:00:00Z', false);

-- Enrollment legado (identidade explícita; representa o resultado do backfill).
INSERT INTO public.trial_offer_enrollments (
  id, store_id, user_id, root_hash, offer_key, started_at, expires_at,
  beneficiary_cnpj_normalized, policy_cohort
) VALUES (
  '00000000-0000-4000-8000-0000000007e1',
  '00000000-0000-4000-8000-0000000006d1',
  '00000000-0000-4000-8000-0000000004c1',
  'root-id', 'trial_28d_v1',
  '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
  '11222333000181', 'root_legacy'
);

-- Duas filiais per_cnpj_f50_4 da mesma raiz (root-id).
INSERT INTO public.trial_offer_enrollments (
  store_id, user_id, root_hash, offer_key, started_at, expires_at,
  beneficiary_cnpj_normalized, policy_cohort
) VALUES
  ('00000000-0000-4000-8000-0000000006d2',
   '00000000-0000-4000-8000-0000000004c1',
   'root-id', 'trial_28d_v1',
   '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
   '11222333000262', 'per_cnpj_f50_4'),
  ('00000000-0000-4000-8000-0000000006d4',
   '00000000-0000-4000-8000-0000000004c2',
   'root-id', 'trial_28d_v1',
   '2026-10-21T00:00:00Z', '2026-11-18T00:00:00Z',
   '11222333000343', 'per_cnpj_f50_4');

-- Fixture de CNPJ alfanumérico canônico (mesma regra da F50.3).
INSERT INTO public.trial_offer_enrollments (
  store_id, user_id, root_hash, offer_key, started_at, expires_at,
  beneficiary_cnpj_normalized, policy_cohort
) VALUES (
  '00000000-0000-4000-8000-0000000006d3',
  '00000000-0000-4000-8000-0000000004c2',
  'root-id-alnum', 'trial_28d_v1',
  '2026-10-21T00:00:00Z', '2026-11-18T00:00:00Z',
  '12ABC345000199', 'per_cnpj_f50_4'
);

-- -----------------------------------------------------------------------------
-- 1. Identidade canônica e coorte padrão do legado
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_mismatch BIGINT;
  v_cohort TEXT;
  v_beneficiary TEXT;
BEGIN
  SELECT count(*) INTO v_mismatch
  FROM public.trial_offer_enrollments e
  JOIN public.stores s ON s.id = e.store_id
  WHERE e.beneficiary_cnpj_normalized IS DISTINCT FROM s.cnpj_normalized;

  IF v_mismatch <> 0 THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: % enrollment(s) com identidade divergente da loja', v_mismatch;
  END IF;

  SELECT policy_cohort, beneficiary_cnpj_normalized
  INTO v_cohort, v_beneficiary
  FROM public.trial_offer_enrollments
  WHERE id = '00000000-0000-4000-8000-0000000007e1';

  IF v_cohort <> 'root_legacy' THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: enrollment legado com coorte errada (%)', v_cohort;
  END IF;

  IF v_beneficiary <> '11222333000181' THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: identidade do legado incorreta';
  END IF;

  -- Insert sem policy_cohort cai no default root_legacy (apenas legado/backfill).
  INSERT INTO public.trial_offer_enrollments (
    store_id, user_id, root_hash, offer_key, started_at, expires_at,
    beneficiary_cnpj_normalized
  ) VALUES (
    '00000000-0000-4000-8000-0000000006d5',
    '00000000-0000-4000-8000-0000000004c1',
    'root-id-5', 'trial_28d_v1',
    '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
    '55666777000140'
  );

  IF (SELECT policy_cohort FROM public.trial_offer_enrollments
      WHERE store_id = '00000000-0000-4000-8000-0000000006d5') <> 'root_legacy' THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: default de policy_cohort deveria ser root_legacy';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. beneficiary_cnpj_normalized é NOT NULL
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_blocked BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at,
      beneficiary_cnpj_normalized, policy_cohort
    ) VALUES (
      '00000000-0000-4000-8000-0000000006d7',
      '00000000-0000-4000-8000-0000000004c1',
      'root-id-7', 'trial_28d_v1',
      '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
      NULL, 'root_legacy'
    );
  EXCEPTION WHEN not_null_violation THEN
    v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: beneficiary_cnpj_normalized aceitou NULL';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Duas filiais per_cnpj_f50_4 da mesma raiz coexistem
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.trial_offer_enrollments
  WHERE root_hash = 'root-id'
    AND policy_cohort = 'per_cnpj_f50_4';

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: esperadas 2 filiais per_cnpj_f50_4 na raiz, obtidas %', v_count;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Segundo root_legacy da mesma raiz falha (índice parcial)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_blocked BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at,
      beneficiary_cnpj_normalized, policy_cohort
    ) VALUES (
      '00000000-0000-4000-8000-0000000006d6',
      '00000000-0000-4000-8000-0000000004c1',
      'root-id', 'trial_28d_v1',
      '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
      '11222333000424', 'root_legacy'
    );
  EXCEPTION WHEN unique_violation THEN
    v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: indice parcial aceitou segundo root_legacy da raiz';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Mesmo CNPJ completo nunca se repete (outra loja/coorte)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_blocked BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at,
      beneficiary_cnpj_normalized, policy_cohort
    ) VALUES (
      '00000000-0000-4000-8000-0000000006d7',
      '00000000-0000-4000-8000-0000000004c1',
      'root-id-7', 'trial_28d_v1',
      '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
      '11222333000181', 'per_cnpj_f50_4'
    );
  EXCEPTION WHEN unique_violation THEN
    v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: CNPJ beneficiario repetido em outra loja/coorte foi aceito';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Trigger de imutabilidade: sete campos recusados, parcelas permitidas
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_fields TEXT[] := ARRAY[
    'beneficiary_cnpj_normalized',
    'policy_cohort',
    'store_id',
    'root_hash',
    'user_id',
    'started_at',
    'expires_at'
  ];
  v_exprs TEXT[] := ARRAY[
    '''99888777000199''',
    '''per_cnpj_f50_4''',
    '''00000000-0000-4000-8000-0000000006d2''::uuid',
    '''root-other''',
    '''00000000-0000-4000-8000-0000000004c2''::uuid',
    'TIMESTAMPTZ ''2026-10-11T00:00:00Z''',
    'TIMESTAMPTZ ''2026-11-08T00:00:00Z'''
  ];
  v_blocked BOOLEAN;
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(v_fields, 1) LOOP
    v_blocked := false;
    BEGIN
      EXECUTE format(
        'UPDATE public.trial_offer_enrollments SET %I = %s WHERE id = %L',
        v_fields[i], v_exprs[i], '00000000-0000-4000-8000-0000000007e1'
      );
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM = 'trial_offer_enrollment_identity_immutable' THEN
        v_blocked := true;
      ELSE
        RAISE;
      END IF;
    END;

    IF NOT v_blocked THEN
      RAISE EXCEPTION 'F50_4_M2_ASSERT: trigger permitiu alterar campo imutavel %', v_fields[i];
    END IF;
  END LOOP;

  -- Parcelas continuam podendo avançar.
  UPDATE public.trial_offer_enrollments
  SET granted_total = granted_total + 5,
      last_granted_seq = 0
  WHERE id = '00000000-0000-4000-8000-0000000007e1';

  IF (SELECT granted_total FROM public.trial_offer_enrollments
      WHERE id = '00000000-0000-4000-8000-0000000007e1') <> 5 THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: trigger bloqueou avanco legitimo de parcela';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. CHECKs de CNPJ e de coorte
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_blocked BOOLEAN;
BEGIN
  v_blocked := false;
  BEGIN
    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at,
      beneficiary_cnpj_normalized, policy_cohort
    ) VALUES (
      '00000000-0000-4000-8000-0000000006d8',
      '00000000-0000-4000-8000-0000000004c1',
      'root-id-8', 'trial_28d_v1',
      '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
      'CNPJ-INVALIDO', 'root_legacy'
    );
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: CHECK aceitou CNPJ fora do padrao canonico';
  END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at,
      beneficiary_cnpj_normalized, policy_cohort
    ) VALUES (
      '00000000-0000-4000-8000-0000000006d8',
      '00000000-0000-4000-8000-0000000004c1',
      'root-id-8', 'trial_28d_v1',
      '2026-10-10T00:00:00Z', '2026-11-07T00:00:00Z',
      '11222333000696', 'coorte_invalida'
    );
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: CHECK aceitou policy_cohort invalida';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. CNPJ numérico e alfanumérico coexistem com a mesma regra canônica
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_numeric INTEGER;
  v_alnum INTEGER;
BEGIN
  SELECT count(*) INTO v_numeric
  FROM public.trial_offer_enrollments
  WHERE beneficiary_cnpj_normalized = '11222333000181';

  SELECT count(*) INTO v_alnum
  FROM public.trial_offer_enrollments
  WHERE beneficiary_cnpj_normalized = '12ABC345000199';

  IF v_numeric <> 1 OR v_alnum <> 1 THEN
    RAISE EXCEPTION 'F50_4_M2_ASSERT: identidade numerica/alfanumerica nao preservada';
  END IF;
END;
$$;

ROLLBACK;
