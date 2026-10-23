-- =============================================================================
-- F50.4 — Prova SQL da integridade do snapshot (Migration M4)
-- Arquivo: tests/sql/f50_4_snapshot_integrity.sql
--
-- Executar em PostgreSQL descartável (plano 50.4-08/12), com M1+M2+M3+M4
-- aplicadas. Script único, transacional, com ROLLBACK no final: nada persiste.
--
-- Cobre:
--   a. INSERT com beneficiário igual ao CNPJ da própria loja é aceito.
--   b. INSERT divergente é rejeitado pelo trigger
--      (`trial_offer_enrollment_beneficiary_mismatch`).
--   c. UPDATE de beneficiary_cnpj_normalized continua rejeitado pelo trigger
--      de imutabilidade da M2 (`trial_offer_enrollment_identity_immutable`).
--   d. INSERT para store_id inexistente ou loja sem CNPJ é rejeitado.
--
-- A suíte falha com RAISE EXCEPTION descritivo se qualquer invariante não valer.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-00000000a601', 'authenticated', 'authenticated',
   'f50-4-snapshot-user-1@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-00000000a602', 'authenticated', 'authenticated',
   'f50-4-snapshot-user-2@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-00000000a603', 'authenticated', 'authenticated',
   'f50-4-snapshot-user-3@test.local', '2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z');

INSERT INTO public.stores (
  id, name, segment, user_id, cnpj_normalized, cnpj_root_hash,
  onboarding_completed_at, is_test_store
) VALUES
  ('00000000-0000-4000-8000-00000000b601', 'snapshot-valid', 'outros',
   '00000000-0000-4000-8000-00000000a601', '11222333000181', 'root-snapshot-1',
   '2026-10-21T00:00:00Z', false),
  ('00000000-0000-4000-8000-00000000b602', 'snapshot-other', 'outros',
   '00000000-0000-4000-8000-00000000a602', '44555666000200', 'root-snapshot-2',
   '2026-10-21T00:00:00Z', false),
  -- Loja sem CNPJ canônico: o snapshot não tem valor válido para comparar.
  ('00000000-0000-4000-8000-00000000b603', 'snapshot-no-cnpj', 'outros',
   '00000000-0000-4000-8000-00000000a603', NULL, 'root-snapshot-3',
   '2026-10-21T00:00:00Z', false);

-- -----------------------------------------------------------------------------
-- a. Snapshot válido (igual ao CNPJ da própria loja) é aceito
-- -----------------------------------------------------------------------------

INSERT INTO public.trial_offer_enrollments (
  id, store_id, user_id, root_hash, offer_key, started_at, expires_at,
  beneficiary_cnpj_normalized, policy_cohort
) VALUES (
  '00000000-0000-4000-8000-00000000c601',
  '00000000-0000-4000-8000-00000000b601',
  '00000000-0000-4000-8000-00000000a601',
  'root-snapshot-1', 'trial_28d_v1',
  '2026-10-21T00:00:00Z', '2026-11-18T00:00:00Z',
  '11222333000181', 'per_cnpj_f50_4'
);

DO $$
DECLARE
  v_snapshot TEXT;
BEGIN
  SELECT e.beneficiary_cnpj_normalized INTO v_snapshot
  FROM public.trial_offer_enrollments e
  WHERE e.id = '00000000-0000-4000-8000-00000000c601';

  IF v_snapshot IS DISTINCT FROM '11222333000181' THEN
    RAISE EXCEPTION 'F50_4_SNAPSHOT_ASSERT: snapshot valido nao foi gravado (%)', v_snapshot;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- b. Snapshot divergente é rejeitado pelo trigger
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at,
      beneficiary_cnpj_normalized, policy_cohort
    ) VALUES (
      '00000000-0000-4000-8000-00000000b601',
      '00000000-0000-4000-8000-00000000a601',
      'root-snapshot-1', 'trial_28d_v1',
      '2026-10-21T00:00:00Z', '2026-11-18T00:00:00Z',
      '44555666000200', 'per_cnpj_f50_4'
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'trial_offer_enrollment_beneficiary_mismatch' THEN
      v_rejected := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'F50_4_SNAPSHOT_ASSERT: trigger aceitou snapshot divergente da loja';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- c. UPDATE do snapshot continua bloqueado pela imutabilidade da M2
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE public.trial_offer_enrollments
    SET beneficiary_cnpj_normalized = '44555666000200'
    WHERE id = '00000000-0000-4000-8000-00000000c601';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'trial_offer_enrollment_identity_immutable' THEN
      v_rejected := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'F50_4_SNAPSHOT_ASSERT: UPDATE do snapshot nao foi bloqueado';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- d. Loja inexistente e loja sem CNPJ são rejeitadas no INSERT
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  v_rejected := false;
  BEGIN
    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at,
      beneficiary_cnpj_normalized, policy_cohort
    ) VALUES (
      '00000000-0000-4000-8000-00000000dead',
      '00000000-0000-4000-8000-00000000a601',
      'root-hopeless', 'trial_28d_v1',
      '2026-10-21T00:00:00Z', '2026-11-18T00:00:00Z',
      '11222333000181', 'per_cnpj_f50_4'
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'trial_offer_enrollment_beneficiary_mismatch' THEN
      v_rejected := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'F50_4_SNAPSHOT_ASSERT: trigger aceitou store_id inexistente';
  END IF;

  v_rejected := false;
  BEGIN
    INSERT INTO public.trial_offer_enrollments (
      store_id, user_id, root_hash, offer_key, started_at, expires_at,
      beneficiary_cnpj_normalized, policy_cohort
    ) VALUES (
      '00000000-0000-4000-8000-00000000b603',
      '00000000-0000-4000-8000-00000000a603',
      'root-snapshot-3', 'trial_28d_v1',
      '2026-10-21T00:00:00Z', '2026-11-18T00:00:00Z',
      '55666777000140', 'per_cnpj_f50_4'
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'trial_offer_enrollment_beneficiary_mismatch' THEN
      v_rejected := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'F50_4_SNAPSHOT_ASSERT: trigger aceitou loja sem CNPJ canonico';
  END IF;
END;
$$;

ROLLBACK;
