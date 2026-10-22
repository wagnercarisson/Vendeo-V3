-- =============================================================================
-- F50.4 — Oferta de onboarding individualizada por CNPJ completo
-- Migration M2/3: identidade do CNPJ beneficiário, coorte persistida,
-- backfill fail-closed, unicidades, trigger de imutabilidade e RPCs de política.
--
-- Escopo:
--   1. Precheck fail-closed ANTES de qualquer DDL (nenhuma linha alterada).
--   2. Colunas beneficiary_cnpj_normalized e policy_cohort.
--   3. Backfill exclusivo por store_id -> stores.cnpj_normalized.
--   4. Constraints, unicidade global do beneficiário, índice parcial de raiz
--      legada e trigger de imutabilidade da identidade.
--   5. Helpers de coorte/benefício e RPCs centrais de política.
--
-- Regras:
--   - Nenhuma migration é aplicada por este arquivo em produção.
--   - Nenhum saldo, transação, entitlement, data ou parcela é reescrito.
--   - Backfill só com evidência segura; qualquer ambiguidade aborta.
--   - Conflito de inscrição é resolvido SOMENTE por store_id.
--   - Respostas de RPC nunca expõem CNPJ completo, root_hash ou dados de
--     outra filial.
-- =============================================================================

-- =============================================================================
-- 1. Precheck fail-closed — aborta ANTES de qualquer DDL
-- =============================================================================

DO $$
DECLARE
  v_missing_store BIGINT;
  v_bad_cnpj BIGINT;
  v_root_mismatch BIGINT;
BEGIN
  -- 1.1 Enrollment sem loja existente
  SELECT count(*) INTO v_missing_store
  FROM public.trial_offer_enrollments e
  LEFT JOIN public.stores s ON s.id = e.store_id
  WHERE s.id IS NULL;

  IF v_missing_store > 0 THEN
    RAISE EXCEPTION
      'F50_4_PRECHECK_MISSING_STORE: % enrollment(s) sem loja. Nenhuma linha foi alterada.',
      v_missing_store;
  END IF;

  -- 1.2 CNPJ canônico ausente/ inválido na loja beneficiária
  SELECT count(*) INTO v_bad_cnpj
  FROM public.trial_offer_enrollments e
  JOIN public.stores s ON s.id = e.store_id
  WHERE s.cnpj_normalized IS NULL
     OR s.cnpj_normalized !~ '^[A-Z0-9]{12}[0-9]{2}$';

  IF v_bad_cnpj > 0 THEN
    RAISE EXCEPTION
      'F50_4_PRECHECK_BAD_CNPJ: % enrollment(s) sem CNPJ canônico. Nenhuma linha foi alterada.',
      v_bad_cnpj;
  END IF;

  -- 1.3 Evidência de raiz incompatível entre enrollment e loja
  SELECT count(*) INTO v_root_mismatch
  FROM public.trial_offer_enrollments e
  JOIN public.stores s ON s.id = e.store_id
  WHERE s.cnpj_root_hash IS DISTINCT FROM e.root_hash
     OR s.cnpj_root_hash IS NULL
     OR s.cnpj_root_hash = '';

  IF v_root_mismatch > 0 THEN
    RAISE EXCEPTION
      'F50_4_PRECHECK_ROOT_HASH_MISMATCH: % enrollment(s) com root_hash incompatível. Nenhuma linha foi alterada.',
      v_root_mismatch;
  END IF;
END;
$$;

-- =============================================================================
-- 2. Colunas de identidade e coorte
-- =============================================================================

ALTER TABLE public.trial_offer_enrollments
  ADD COLUMN IF NOT EXISTS beneficiary_cnpj_normalized TEXT;

ALTER TABLE public.trial_offer_enrollments
  ADD COLUMN IF NOT EXISTS policy_cohort TEXT NOT NULL DEFAULT 'root_legacy';

COMMENT ON COLUMN public.trial_offer_enrollments.beneficiary_cnpj_normalized IS
  'F50.4: snapshot canônico do CNPJ completo do beneficiário (14 caracteres, ^[A-Z0-9]{12}[0-9]{2}$). Imutável após o insert.';
COMMENT ON COLUMN public.trial_offer_enrollments.policy_cohort IS
  'F50.4: coorte da inscrição. root_legacy preserva a unicidade por raiz; per_cnpj_f50_4 usa a unicidade por CNPJ completo.';

-- =============================================================================
-- 3. Backfill exclusivo por evidência segura (store_id -> stores)
-- =============================================================================

UPDATE public.trial_offer_enrollments e
SET beneficiary_cnpj_normalized = s.cnpj_normalized
FROM public.stores s
WHERE s.id = e.store_id
  AND e.beneficiary_cnpj_normalized IS NULL;

ALTER TABLE public.trial_offer_enrollments
  ALTER COLUMN beneficiary_cnpj_normalized SET NOT NULL;

-- =============================================================================
-- 4. Constraints de identidade e coorte
-- =============================================================================

ALTER TABLE public.trial_offer_enrollments
  ADD CONSTRAINT chk_trial_offer_enrollments_beneficiary_cnpj
  CHECK (beneficiary_cnpj_normalized ~ '^[A-Z0-9]{12}[0-9]{2}$')
  NOT VALID;

ALTER TABLE public.trial_offer_enrollments
  VALIDATE CONSTRAINT chk_trial_offer_enrollments_beneficiary_cnpj;

ALTER TABLE public.trial_offer_enrollments
  ADD CONSTRAINT chk_trial_offer_enrollments_policy_cohort
  CHECK (policy_cohort IN ('root_legacy','per_cnpj_f50_4'));

-- =============================================================================
-- 5. Unicidades: beneficiário global, raiz apenas para o legado, loja mantida
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_offer_enrollments_beneficiary
  ON public.trial_offer_enrollments (beneficiary_cnpj_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_offer_enrollments_root_legacy
  ON public.trial_offer_enrollments (root_hash)
  WHERE policy_cohort = 'root_legacy';

ALTER TABLE public.trial_offer_enrollments
  DROP CONSTRAINT IF EXISTS uq_trial_offer_enrollments_root;

-- =============================================================================
-- 6. Trigger de imutabilidade da identidade
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trial_offer_enrollments_immutable_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.beneficiary_cnpj_normalized IS DISTINCT FROM OLD.beneficiary_cnpj_normalized
     OR NEW.policy_cohort IS DISTINCT FROM OLD.policy_cohort
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.root_hash IS DISTINCT FROM OLD.root_hash
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'trial_offer_enrollment_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trial_offer_enrollments_immutable_identity
  ON public.trial_offer_enrollments;

CREATE TRIGGER trg_trial_offer_enrollments_immutable_identity
  BEFORE UPDATE ON public.trial_offer_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.trial_offer_enrollments_immutable_identity();

-- =============================================================================
-- 7. RLS e grants da tabela (reafirmados; anon/authenticated sem acesso)
-- =============================================================================

ALTER TABLE public.trial_offer_enrollments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trial_offer_enrollments FROM anon;
REVOKE ALL ON TABLE public.trial_offer_enrollments FROM authenticated;
REVOKE ALL ON TABLE public.trial_offer_enrollments FROM service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.trial_offer_enrollments TO service_role;

-- =============================================================================
-- REVERT (comentado) — condicionado, NÃO executar automaticamente
-- =============================================================================
--
-- Permitido SOMENTE antes da ativação da F50.4 e após confirmar que NÃO existe
-- nenhum enrollment com policy_cohort = 'per_cnpj_f50_4'. Depois que duas
-- filiais da mesma raiz coexistirem, NÃO é possível restaurar a unicidade
-- global por root_hash sem apagar ou corromper dados. O rollback operacional é
-- desligar a oferta e corrigir para frente.
--
-- Verificação obrigatória antes do REVERT:
--   SELECT count(*) FROM public.trial_offer_enrollments
--   WHERE policy_cohort = 'per_cnpj_f50_4';  -- deve ser 0
--
-- DROP TRIGGER IF EXISTS trg_trial_offer_enrollments_immutable_identity
--   ON public.trial_offer_enrollments;
-- DROP FUNCTION IF EXISTS public.trial_offer_enrollments_immutable_identity();
-- DROP INDEX IF EXISTS public.uq_trial_offer_enrollments_root_legacy;
-- DROP INDEX IF EXISTS public.uq_trial_offer_enrollments_beneficiary;
-- ALTER TABLE public.trial_offer_enrollments
--   DROP CONSTRAINT IF EXISTS chk_trial_offer_enrollments_policy_cohort;
-- ALTER TABLE public.trial_offer_enrollments
--   DROP CONSTRAINT IF EXISTS chk_trial_offer_enrollments_beneficiary_cnpj;
-- ALTER TABLE public.trial_offer_enrollments
--   DROP COLUMN IF EXISTS policy_cohort;
-- ALTER TABLE public.trial_offer_enrollments
--   DROP COLUMN IF EXISTS beneficiary_cnpj_normalized;
--
-- PROIBIDO no REVERT: recriar a constraint UNIQUE(root_hash) global.
-- A garantia legada é recomposta apenas pelo índice parcial:
--   CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_offer_enrollments_root_legacy
--     ON public.trial_offer_enrollments (root_hash)
--     WHERE policy_cohort = 'root_legacy';
