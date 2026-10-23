-- =============================================================================
-- F50.4 — Oferta de onboarding individualizada por CNPJ completo
-- Migration M4/4: integridade do snapshot de CNPJ no INSERT.
--
-- Escopo (aditivo, fail-closed, NÃO aplicado nesta execução):
--   1. Precheck que aborta ANTES de qualquer DDL quando algum enrollment já
--      diverge do CNPJ canônico da própria loja (ou aponta para loja
--      inexistente / sem CNPJ).
--   2. Trigger BEFORE INSERT que impede novo snapshot divergente.
--   3. Trigger de imutabilidade de UPDATE permanece intacto (M2).
--
-- Regras:
--   - Nenhuma coluna, índice ou constraint existente é redefinido aqui.
--   - `beneficiary_cnpj_normalized` continua sendo o snapshot histórico do
--     insert; validar a igualdade no INSERT NÃO transforma o snapshot em
--     vínculo mutável com `stores`. Alterações posteriores do CNPJ da loja não
--     reescrevem o snapshot e continuam bloqueadas pelo trigger de UPDATE.
--   - Nenhuma conexão, container ou migration foi executada por este arquivo.
-- =============================================================================

-- =============================================================================
-- 1. Precheck fail-closed — aborta ANTES de qualquer DDL
-- =============================================================================

DO $$
DECLARE
  v_mismatch BIGINT;
BEGIN
  SELECT count(*) INTO v_mismatch
  FROM public.trial_offer_enrollments e
  LEFT JOIN public.stores s ON s.id = e.store_id
  WHERE s.id IS NULL
     OR s.cnpj_normalized IS NULL
     OR e.beneficiary_cnpj_normalized IS DISTINCT FROM s.cnpj_normalized;

  IF v_mismatch > 0 THEN
    RAISE EXCEPTION
      'F50_4_PRECHECK_BENEFICIARY_MISMATCH: % enrollment(s) com snapshot divergente da loja. Nenhuma linha foi alterada.',
      v_mismatch;
  END IF;
END;
$$;

-- =============================================================================
-- 2. Função de validação do snapshot no INSERT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trial_offer_enrollments_validate_beneficiary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_cnpj TEXT;
BEGIN
  SELECT s.cnpj_normalized INTO v_store_cnpj
  FROM public.stores s
  WHERE s.id = NEW.store_id;

  IF v_store_cnpj IS NULL
     OR v_store_cnpj IS DISTINCT FROM NEW.beneficiary_cnpj_normalized THEN
    RAISE EXCEPTION 'trial_offer_enrollment_beneficiary_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trial_offer_enrollments_validate_beneficiary() IS
  'F50.4: rejeita INSERT em trial_offer_enrollments cujo beneficiary_cnpj_normalized difira do CNPJ canônico da própria store_id (ou cuja loja não exista/sem CNPJ). Não afeta UPDATE.';

-- =============================================================================
-- 3. Trigger BEFORE INSERT (o trigger de imutabilidade de UPDATE é preservado)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_trial_offer_enrollments_validate_beneficiary
  ON public.trial_offer_enrollments;

CREATE TRIGGER trg_trial_offer_enrollments_validate_beneficiary
  BEFORE INSERT ON public.trial_offer_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.trial_offer_enrollments_validate_beneficiary();

-- =============================================================================
-- 4. Privilégios: função de trigger restrita ao service_role
-- =============================================================================

REVOKE ALL ON FUNCTION public.trial_offer_enrollments_validate_beneficiary()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_offer_enrollments_validate_beneficiary()
  TO service_role;

-- =============================================================================
-- REVERT (comentado) — condicionado, NÃO executar automaticamente
-- =============================================================================
--
-- DROP TRIGGER IF EXISTS trg_trial_offer_enrollments_validate_beneficiary
--   ON public.trial_offer_enrollments;
-- DROP FUNCTION IF EXISTS public.trial_offer_enrollments_validate_beneficiary();
--
-- O REVERT devolve o banco ao estado anterior (sem validação no INSERT). Não
-- reabre o trigger de imutabilidade de UPDATE, que pertence à M2.
