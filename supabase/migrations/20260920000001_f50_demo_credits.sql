-- =============================================================================
-- F50 — Demonstração Gratuita e Validade dos Créditos — Migration ESTRUTURAL
-- (D1/D2/D7 — SEM publicar documentos legais)
--
-- Escopo desta migration (estrutural, backward-compatible):
--   1. credit_balances: 5 colunas demo + CHECK composto de coerência
--   2. credit_transactions: CHECKs type (9 tipos) e amount_sign (demo/expiration)
--   3. sync_credit_balances_total: balance = demo + bonus + purchased
--   4. freemium_entitlements: benefit_type += 'demo' (SEM conversão de onboarding)
--   5. Tabelas novas: credit_notifications, product_events, support_credit_requests, data_subject_requests
--   6. access_requests: privacy_notice_version
--
-- NÃO publica legal_document_versions / documentos legais (50-10).
-- Backfill com defaults — SEM expiração retroativa (D8).
-- =============================================================================

-- =============================================================================
-- 1. credit_balances — colunas do bucket de demonstração (D1)
-- =============================================================================
ALTER TABLE public.credit_balances
  ADD COLUMN IF NOT EXISTS demo_balance INTEGER NOT NULL DEFAULT 0 CHECK (demo_balance >= 0);

ALTER TABLE public.credit_balances
  ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ;

ALTER TABLE public.credit_balances
  ADD COLUMN IF NOT EXISTS demo_cycle_id UUID;

ALTER TABLE public.credit_balances
  ADD COLUMN IF NOT EXISTS origin_demo_grant_tx_id UUID;

ALTER TABLE public.credit_balances
  ADD COLUMN IF NOT EXISTS demo_contributing_tx_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.credit_balances.demo_balance IS 'Saldo da demonstração gratuita (expira em demo_expires_at).';
COMMENT ON COLUMN public.credit_balances.demo_expires_at IS 'Fonte de verdade autoritativa da validade da demo. NULL = sem demonstração ativa.';
COMMENT ON COLUMN public.credit_balances.demo_cycle_id IS 'Episódio corrente da demo (muda a cada episódio de graça; zera na expiração).';
COMMENT ON COLUMN public.credit_balances.origin_demo_grant_tx_id IS 'Grant original da demo (estável — NUNCA zerado pela expiração).';
COMMENT ON COLUMN public.credit_balances.demo_contributing_tx_ids IS 'Transações que contribuíram ao episódio corrente (grant + refunds de graça).';

-- Invariante (D1/D4): demo_balance > 0 implica demo_expires_at/demo_cycle_id/origin_demo_grant_tx_id não nulos.
ALTER TABLE public.credit_balances DROP CONSTRAINT IF EXISTS chk_credit_balances_demo_coherence;
ALTER TABLE public.credit_balances ADD CONSTRAINT chk_credit_balances_demo_coherence
  CHECK (
    demo_balance = 0
    OR (
      demo_expires_at IS NOT NULL
      AND demo_cycle_id IS NOT NULL
      AND origin_demo_grant_tx_id IS NOT NULL
    )
  );

-- =============================================================================
-- 2. credit_transactions — tipos demo/expiration (D2)
-- =============================================================================
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS chk_credit_transactions_type;
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS chk_credit_transactions_amount_sign;

ALTER TABLE public.credit_transactions ADD CONSTRAINT chk_credit_transactions_type
  CHECK (type = ANY (ARRAY[
    'bonus_onboarding'::text,
    'bonus_monthly'::text,
    'admin_grant'::text,
    'purchase'::text,
    'deduction'::text,
    'refund'::text,
    'adjustment'::text,
    'demo'::text,
    'expiration'::text
  ]));

ALTER TABLE public.credit_transactions ADD CONSTRAINT chk_credit_transactions_amount_sign
  CHECK (
    (type IN ('bonus_onboarding', 'bonus_monthly', 'admin_grant', 'purchase', 'refund', 'demo') AND amount > 0)
    OR (type = 'deduction' AND amount < 0)
    OR (type = 'expiration' AND amount < 0)
    OR (type = 'adjustment' AND amount <> 0)
  );

-- =============================================================================
-- 3. sync_credit_balances_total — soma dos 3 buckets (D1)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_credit_balances_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance := NEW.demo_balance + NEW.bonus_balance + NEW.purchased_balance;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. freemium_entitlements — benefit_type 'demo' (D7, SEM conversão)
-- =============================================================================
ALTER TABLE public.freemium_entitlements DROP CONSTRAINT IF EXISTS freemium_entitlements_benefit_type_check;
ALTER TABLE public.freemium_entitlements ADD CONSTRAINT freemium_entitlements_benefit_type_check
  CHECK (benefit_type IN ('onboarding', 'monthly', 'admin_exception', 'demo'));

COMMENT ON COLUMN public.freemium_entitlements.benefit_type IS 'Tipo do benefício: onboarding (10 créditos), monthly (5 créditos/mês), admin_exception (exceção manual), demo (demonstração gratuita com validade).';

-- =============================================================================
-- 5. Tabelas novas (D10/D12/D14/D21)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.1 credit_notifications (outbox de notificações in-app + email)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('demo_granted','demo_expiring_24h','demo_expired','demo_exhausted','support_ack','support_notice')),
  dedup_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  inapp_delivered_at TIMESTAMPTZ,
  inapp_read_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','processing','sent','failed','suppressed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  last_error TEXT,
  provider_message_id TEXT,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_notifications IS 'Outbox de notificações da demonstração (in-app + email). dedup lógico por (store_id, kind, dedup_key).';
COMMENT ON COLUMN public.credit_notifications.email_status IS 'Máquina de estados do envio: pending → processing → sent | failed | suppressed. support_ack/support_notice nunca suprimidos.';
COMMENT ON COLUMN public.credit_notifications.email_sent_at IS 'Instante em que o provedor ACEITOU a mensagem (aceitação ≠ entrega).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_notifications_dedup
  ON public.credit_notifications (store_id, kind, dedup_key);

CREATE INDEX IF NOT EXISTS idx_credit_notifications_user
  ON public.credit_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_notifications_email_due
  ON public.credit_notifications (email_status, next_attempt_at)
  WHERE email_status IN ('pending', 'processing');

ALTER TABLE public.credit_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_credit_notifications" ON public.credit_notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "owner_select_credit_notifications" ON public.credit_notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND kind <> 'support_notice');

REVOKE ALL ON TABLE public.credit_notifications FROM anon;
REVOKE ALL ON TABLE public.credit_notifications FROM authenticated;
REVOKE ALL ON TABLE public.credit_notifications FROM service_role;

GRANT SELECT ON TABLE public.credit_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.credit_notifications TO service_role;

-- -----------------------------------------------------------------------------
-- 5.2 product_events (telemetria de produto — append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  dedup_key TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_events IS 'Telemetria de produto (F51). Append-only; escrita best-effort via service_role.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_events_dedup
  ON public.product_events (event_type, dedup_key);

CREATE INDEX IF NOT EXISTS idx_product_events_user
  ON public.product_events (user_id, created_at DESC);

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_product_events" ON public.product_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.product_events FROM anon;
REVOKE ALL ON TABLE public.product_events FROM authenticated;
REVOKE ALL ON TABLE public.product_events FROM service_role;

GRANT SELECT, INSERT ON TABLE public.product_events TO service_role;

-- -----------------------------------------------------------------------------
-- 5.3 support_credit_requests (fonte canônica de solicitações de crédito)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_credit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE,
  protocol TEXT NOT NULL UNIQUE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_email TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','forwarded','responded','closed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  response_due_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.support_credit_requests IS 'Solicitações de crédito ao suporte (fonte canônica, idempotente por operation_id).';
COMMENT ON COLUMN public.support_credit_requests.response_due_at IS 'NULL até a validação jurídica da meta de resposta (Decreto 7.962/2013).';

CREATE INDEX IF NOT EXISTS idx_support_credit_requests_store
  ON public.support_credit_requests (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_credit_requests_user
  ON public.support_credit_requests (user_id, created_at DESC);

ALTER TABLE public.support_credit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_support_credit_requests" ON public.support_credit_requests
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.support_credit_requests FROM anon;
REVOKE ALL ON TABLE public.support_credit_requests FROM authenticated;
REVOKE ALL ON TABLE public.support_credit_requests FROM service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.support_credit_requests TO service_role;

-- -----------------------------------------------------------------------------
-- 5.4 data_subject_requests (pedidos de titular — LGPD/encerramento)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE,
  protocol TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('access','export','correction','deletion','closure')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  contact TEXT,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_progress','completed','cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  closure_requested_at TIMESTAMPTZ,
  deletion_due_at TIMESTAMPTZ,
  deletion_inventory JSONB,
  legal_hold BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_subject_requests IS 'Pedidos de titular (acesso/exportação/correção/exclusão/encerramento) — ciclo de vida e auditoria.';
COMMENT ON COLUMN public.data_subject_requests.due_at IS 'NULL até a aprovação dos prazos jurídicos (não codifica prazo unilateralmente).';
COMMENT ON COLUMN public.data_subject_requests.deletion_inventory IS 'Evidência do inventário de exportação/exclusão/anonimização.';
COMMENT ON COLUMN public.data_subject_requests.legal_hold IS 'Retenção legal mínima segregada, quando aplicável.';

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_user
  ON public.data_subject_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_store
  ON public.data_subject_requests (store_id, created_at DESC);

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_data_subject_requests" ON public.data_subject_requests
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "owner_select_data_subject_requests" ON public.data_subject_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.data_subject_requests FROM anon;
REVOKE ALL ON TABLE public.data_subject_requests FROM authenticated;
REVOKE ALL ON TABLE public.data_subject_requests FROM service_role;

GRANT SELECT ON TABLE public.data_subject_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.data_subject_requests TO service_role;

-- =============================================================================
-- 6. access_requests — privacy_notice_version (D18)
-- =============================================================================
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS privacy_notice_version TEXT;

COMMENT ON COLUMN public.access_requests.privacy_notice_version IS 'Versão do aviso de privacidade apresentado no formulário (auditável).';

-- =============================================================================
-- REVERT (ordem reversa da criação)
-- =============================================================================
-- ALTER TABLE public.access_requests DROP COLUMN IF EXISTS privacy_notice_version;

-- DROP POLICY IF EXISTS "owner_select_data_subject_requests" ON public.data_subject_requests;
-- DROP POLICY IF EXISTS "service_role_all_data_subject_requests" ON public.data_subject_requests;
-- DROP TABLE IF EXISTS public.data_subject_requests CASCADE;

-- DROP POLICY IF EXISTS "service_role_all_support_credit_requests" ON public.support_credit_requests;
-- DROP TABLE IF EXISTS public.support_credit_requests CASCADE;

-- DROP POLICY IF EXISTS "service_role_all_product_events" ON public.product_events;
-- DROP TABLE IF EXISTS public.product_events CASCADE;

-- DROP POLICY IF EXISTS "owner_select_credit_notifications" ON public.credit_notifications;
-- DROP POLICY IF EXISTS "service_role_all_credit_notifications" ON public.credit_notifications;
-- DROP TABLE IF EXISTS public.credit_notifications CASCADE;

-- ALTER TABLE public.freemium_entitlements DROP CONSTRAINT IF EXISTS freemium_entitlements_benefit_type_check;
-- ALTER TABLE public.freemium_entitlements ADD CONSTRAINT freemium_entitlements_benefit_type_check
--   CHECK (benefit_type IN ('onboarding', 'monthly', 'admin_exception'));

-- CREATE OR REPLACE FUNCTION public.sync_credit_balances_total()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.balance := NEW.bonus_balance + NEW.purchased_balance;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS chk_credit_transactions_amount_sign;
-- ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS chk_credit_transactions_type;
-- ALTER TABLE public.credit_transactions ADD CONSTRAINT chk_credit_transactions_type
--   CHECK (type = ANY (ARRAY['bonus_onboarding'::text, 'bonus_monthly'::text, 'admin_grant'::text, 'purchase'::text, 'deduction'::text, 'refund'::text, 'adjustment'::text]));
-- ALTER TABLE public.credit_transactions ADD CONSTRAINT chk_credit_transactions_amount_sign
--   CHECK (
--     (type IN ('bonus_onboarding', 'bonus_monthly', 'admin_grant', 'purchase', 'refund') AND amount > 0)
--     OR (type = 'deduction' AND amount < 0)
--     OR (type = 'adjustment' AND amount <> 0)
--   );

-- ALTER TABLE public.credit_balances DROP CONSTRAINT IF EXISTS chk_credit_balances_demo_coherence;
-- ALTER TABLE public.credit_balances DROP COLUMN IF EXISTS demo_contributing_tx_ids;
-- ALTER TABLE public.credit_balances DROP COLUMN IF EXISTS origin_demo_grant_tx_id;
-- ALTER TABLE public.credit_balances DROP COLUMN IF EXISTS demo_cycle_id;
-- ALTER TABLE public.credit_balances DROP COLUMN IF EXISTS demo_expires_at;
-- ALTER TABLE public.credit_balances DROP COLUMN IF EXISTS demo_balance;
