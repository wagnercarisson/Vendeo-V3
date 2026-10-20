-- =============================================================================
-- F50.2 — Oferta de teste gratuito de 28 dias
-- Migration 02/04: enrollment por beneficiário.
--
-- Regras:
--   - Um enrollment por raiz de CNPJ e por loja.
--   - started_at vem de stores.onboarding_completed_at (nunca now()).
--   - expires_at = started_at + 28 dias.
--   - granted_total máximo 20; last_granted_seq -1..3.
--   - Sem coluna de status: vencimento é derivado do relógio.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trial_offer_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  root_hash TEXT NOT NULL,
  offer_key TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  granted_total INTEGER NOT NULL DEFAULT 0,
  last_granted_seq INTEGER NOT NULL DEFAULT -1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_trial_offer_enrollments_granted_total
    CHECK (granted_total >= 0 AND granted_total <= 20),
  CONSTRAINT chk_trial_offer_enrollments_last_seq
    CHECK (last_granted_seq >= -1 AND last_granted_seq <= 3),
  CONSTRAINT chk_trial_offer_enrollments_window
    CHECK (expires_at > started_at),
  CONSTRAINT uq_trial_offer_enrollments_root UNIQUE (root_hash),
  CONSTRAINT uq_trial_offer_enrollments_store UNIQUE (store_id)
);

COMMENT ON TABLE public.trial_offer_enrollments IS
  'Registro do teste gratuito de 28 dias por beneficiário (loja/raiz), com início, vencimento e parcelas.';
COMMENT ON COLUMN public.trial_offer_enrollments.started_at IS
  'Igual a stores.onboarding_completed_at; nunca recalculado.';
COMMENT ON COLUMN public.trial_offer_enrollments.granted_total IS
  'Total concedido pelo programa (máximo 20), não limite de saldo.';
COMMENT ON COLUMN public.trial_offer_enrollments.last_granted_seq IS
  'Última parcela concedida (-1 = nenhuma; 0..3 = parcelas).';

CREATE INDEX IF NOT EXISTS idx_trial_offer_enrollments_due
  ON public.trial_offer_enrollments (expires_at, last_granted_seq);

ALTER TABLE public.trial_offer_enrollments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trial_offer_enrollments FROM anon;
REVOKE ALL ON TABLE public.trial_offer_enrollments FROM authenticated;
REVOKE ALL ON TABLE public.trial_offer_enrollments FROM service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.trial_offer_enrollments TO service_role;

-- =============================================================================
-- REVERT (comentado)
-- =============================================================================
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.trial_offer_enrollments FROM service_role;
-- DROP TABLE IF EXISTS public.trial_offer_enrollments;
