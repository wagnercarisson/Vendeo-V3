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
-- 7. RPCs SQL (D3/D4/D5/D6/D16)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 7.1 try_grant_demo_entitlement (D3/D7)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_grant_demo_entitlement(
  p_store_id UUID,
  p_root_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type)
  VALUES (p_store_id, p_root_hash, 'demo')
  ON CONFLICT (root_hash, benefit_type, (COALESCE(cycle, '_nostring_')))
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7.2 grant_demo_credits (D3/D16) — flag obrigatória + gating interno
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_demo_credits(
  p_store_id UUID,
  p_root_hash TEXT,
  p_amount INTEGER,
  p_demo_grant_enabled BOOLEAN,
  p_ttl_hours INTEGER DEFAULT 168,
  p_idempotency_key TEXT DEFAULT NULL,
  p_granted_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grant_tx_id UUID;
  v_entitlement_id UUID;
  v_demo_expires_at TIMESTAMPTZ;
  v_user_id UUID;
BEGIN
  IF p_demo_grant_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'disabled');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'amount_invalido');
  END IF;

  -- Elegibilidade ANTES de qualquer INSERT (evita entitlement demo órfão)
  IF EXISTS (SELECT 1 FROM public.freemium_entitlements
             WHERE root_hash = p_root_hash AND benefit_type = 'onboarding') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'onboarding_consumed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.freemium_entitlements
             WHERE root_hash = p_root_hash AND benefit_type = 'admin_exception') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'admin_exception_consumed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.freemium_entitlements
             WHERE store_id = p_store_id AND benefit_type = 'admin_exception') THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'admin_exception_consumed');
  END IF;

  v_entitlement_id := public.try_grant_demo_entitlement(p_store_id, p_root_hash);

  IF v_entitlement_id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_granted');
  END IF;

  v_demo_expires_at := now() + make_interval(hours => p_ttl_hours);

  SELECT user_id INTO v_user_id FROM public.stores WHERE id = p_store_id;

  v_grant_tx_id := public.grant_credits(
    p_store_id,
    p_amount,
    'demo',
    p_idempotency_key,
    jsonb_build_object('source', 'demo_grant', 'ttl_hours', p_ttl_hours),
    'demo',
    v_demo_expires_at
  );

  UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
  WHERE id = v_entitlement_id;

  IF p_granted_by IS NOT NULL THEN
    INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
    VALUES ('credit_grant', 'store', p_store_id, p_granted_by, 'Concessão de demonstração gratuita',
      jsonb_build_object('grant_type', 'demo', 'grant_transaction_id', v_grant_tx_id, 'entitlement_id', v_entitlement_id));
  END IF;

  -- Best-effort: telemetria + notificação (falha NUNCA reverte a concessão)
  BEGIN
    INSERT INTO public.product_events (store_id, user_id, event_type, dedup_key, properties)
    VALUES (p_store_id, v_user_id, 'demo_granted', v_grant_tx_id::text,
      jsonb_build_object('grant_tx_id', v_grant_tx_id, 'amount', p_amount))
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'demo_granted best-effort (product_events): %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.credit_notifications (store_id, user_id, kind, dedup_key, payload)
    VALUES (p_store_id, v_user_id, 'demo_granted', v_grant_tx_id::text,
      jsonb_build_object('grant_tx_id', v_grant_tx_id, 'amount', p_amount))
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'demo_granted best-effort (credit_notifications): %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'granted', true,
    'grant_transaction_id', v_grant_tx_id,
    'demo_expires_at', v_demo_expires_at,
    'entitlement_id', v_entitlement_id
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7.3 grant_credits com p_type='demo' (D3)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.grant_credits(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.grant_credits(
  p_store_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_type TEXT DEFAULT 'admin_grant',
  p_demo_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  balance_before INTEGER;
  balance_after INTEGER;
  tx_id UUID;
  existing_tx_id UUID;
  bonus_old INTEGER;
  purchased_old INTEGER;
  demo_old INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalido';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_tx_id
    FROM public.credit_transactions
    WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF (SELECT (type = p_type AND amount = p_amount) FROM public.credit_transactions WHERE id = existing_tx_id) THEN
        RETURN existing_tx_id;
      ELSE
        RAISE EXCEPTION 'idempotency_conflict';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.credit_balances (store_id, balance)
  VALUES (p_store_id, 0)
  ON CONFLICT (store_id) DO NOTHING;

  SELECT balance, bonus_balance, purchased_balance, demo_balance
  INTO balance_before, bonus_old, purchased_old, demo_old
  FROM public.credit_balances
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF balance_before IS NULL THEN
    INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance, demo_balance)
    VALUES (p_store_id, 0, 0, 0, 0)
    ON CONFLICT (store_id) DO NOTHING;
    balance_before := 0;
    bonus_old := 0;
    purchased_old := 0;
    demo_old := 0;
  END IF;

  IF p_type = 'demo' THEN
    IF p_demo_expires_at IS NULL OR p_demo_expires_at <= now() THEN
      RAISE EXCEPTION 'demo_expires_invalido';
    END IF;
    demo_old := demo_old + p_amount;
  ELSIF p_type IN ('bonus_onboarding', 'bonus_monthly', 'admin_grant') THEN
    bonus_old := bonus_old + p_amount;
  ELSIF p_type = 'purchase' THEN
    purchased_old := purchased_old + p_amount;
  ELSE
    RAISE EXCEPTION 'tipo_invalido';
  END IF;

  balance_after := demo_old + bonus_old + purchased_old;

  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    reason, idempotency_key, metadata
  ) VALUES (
    p_store_id, p_type, p_amount, balance_before, balance_after,
    p_reason, p_idempotency_key, p_metadata
  )
  RETURNING id INTO tx_id;

  IF p_type = 'demo' THEN
    UPDATE public.credit_balances
    SET demo_balance = demo_old,
        demo_expires_at = p_demo_expires_at,
        demo_cycle_id = tx_id,
        origin_demo_grant_tx_id = tx_id,
        demo_contributing_tx_ids = ARRAY[tx_id]
    WHERE store_id = p_store_id;
  ELSE
    UPDATE public.credit_balances
    SET bonus_balance = bonus_old,
        purchased_balance = purchased_old
    WHERE store_id = p_store_id;
  END IF;

  RETURN tx_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7.4 materialize_demo_expiration (D5)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materialize_demo_expiration(
  p_store_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_demo_balance INTEGER;
  v_demo_expires_at TIMESTAMPTZ;
  v_demo_cycle_id UUID;
  v_origin UUID;
  v_contributing UUID[];
  v_bonus INTEGER;
  v_purchased INTEGER;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_available INTEGER;
  v_tx_id UUID;
BEGIN
  SELECT demo_balance, demo_expires_at, demo_cycle_id, origin_demo_grant_tx_id, demo_contributing_tx_ids, bonus_balance, purchased_balance, balance
  INTO v_demo_balance, v_demo_expires_at, v_demo_cycle_id, v_origin, v_contributing, v_bonus, v_purchased, v_balance_before
  FROM public.credit_balances
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF v_demo_balance IS NULL THEN
    RETURN jsonb_build_object('expired', false, 'reason', 'no_balance_row', 'available', 0);
  END IF;

  IF v_demo_balance = 0 THEN
    RETURN jsonb_build_object('expired', false, 'reason', 'no_demo_balance', 'available', v_bonus + v_purchased);
  END IF;

  IF v_demo_expires_at IS NULL OR v_demo_expires_at > now() THEN
    RETURN jsonb_build_object('expired', false, 'reason', 'not_expired', 'available', v_demo_balance + v_bonus + v_purchased);
  END IF;

  v_balance_after := v_balance_before - v_demo_balance;

  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    reason, reference, metadata
  ) VALUES (
    p_store_id, 'expiration', -v_demo_balance, v_balance_before, v_balance_after,
    'expiração da demonstração',
    v_demo_cycle_id::text,
    jsonb_build_object(
      'bucket', 'demo',
      'expired_amount', v_demo_balance,
      'cycle_id', v_demo_cycle_id,
      'origin_demo_grant_tx_id', v_origin,
      'contributing_tx_ids', to_jsonb(v_contributing::text[])
    )
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.credit_balances
  SET demo_balance = 0,
      demo_expires_at = NULL,
      demo_cycle_id = NULL,
      demo_contributing_tx_ids = '{}'::uuid[]
  WHERE store_id = p_store_id;

  RETURN jsonb_build_object('expired', true, 'expiration_tx_id', v_tx_id, 'available', v_bonus + v_purchased);
END;
$$;

-- -----------------------------------------------------------------------------
-- 7.5 reserve_credit — materializa + ordem demo→bônus→comprado (D4)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_credit(
  p_store_id UUID,
  p_amount INTEGER,
  p_campaign_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_bonus INTEGER;
  current_purchased INTEGER;
  current_demo INTEGER;
  demo_expires TIMESTAMPTZ;
  demo_cycle UUID;
  demo_origin UUID;
  balance_before INTEGER;
  balance_after INTEGER;
  tx_id UUID;
  existing_tx_id UUID;
  amount_restante INTEGER;
  deduct_from_demo INTEGER;
  deduct_from_bonus INTEGER;
  deduct_from_purchased INTEGER;
  demo_before INTEGER;
  demo_after INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalido';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_tx_id
    FROM public.credit_transactions
    WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF (SELECT type FROM public.credit_transactions WHERE id = existing_tx_id) = 'deduction' THEN
        RETURN existing_tx_id;
      ELSE
        RAISE EXCEPTION 'idempotency_conflict';
      END IF;
    END IF;
  END IF;

  -- Materializa expiração pendente (idempotente) na mesma transação
  PERFORM public.materialize_demo_expiration(p_store_id);

  SELECT balance, bonus_balance, purchased_balance, demo_balance, demo_expires_at, demo_cycle_id, origin_demo_grant_tx_id
  INTO balance_before, current_bonus, current_purchased, current_demo, demo_expires, demo_cycle, demo_origin
  FROM public.credit_balances
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF balance_before IS NULL THEN
    RAISE EXCEPTION 'saldo_inexistente';
  END IF;

  -- Saldo disponível: demo só conta se ativa (expires > now())
  IF demo_expires IS NULL OR demo_expires <= now() THEN
    current_demo := 0;
  END IF;

  IF (current_demo + current_bonus + current_purchased) < p_amount THEN
    RAISE EXCEPTION 'saldo_insuficiente';
  END IF;

  demo_before := current_demo;

  -- Ordem de consumo: demo → bônus → comprado
  amount_restante := p_amount;
  deduct_from_demo := LEAST(current_demo, amount_restante);
  current_demo := current_demo - deduct_from_demo;
  amount_restante := amount_restante - deduct_from_demo;
  deduct_from_bonus := LEAST(current_bonus, amount_restante);
  current_bonus := current_bonus - deduct_from_bonus;
  amount_restante := amount_restante - deduct_from_bonus;
  deduct_from_purchased := LEAST(current_purchased, amount_restante);
  current_purchased := current_purchased - deduct_from_purchased;
  amount_restante := amount_restante - deduct_from_purchased;
  IF amount_restante > 0 THEN
    RAISE EXCEPTION 'saldo_insuficiente';
  END IF;

  demo_after := current_demo;
  balance_after := current_demo + current_bonus + current_purchased;

  p_metadata := p_metadata || jsonb_build_object(
    'demo_amount', deduct_from_demo,
    'bonus_amount', deduct_from_bonus,
    'purchased_amount', deduct_from_purchased,
    'demo_expires_at', demo_expires,
    'demo_cycle_id', demo_cycle,
    'origin_demo_grant_tx_id', demo_origin,
    'demo_before', demo_before,
    'demo_after', demo_after
  );

  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    campaign_id, idempotency_key, metadata
  ) VALUES (
    p_store_id, 'deduction', -p_amount, balance_before, balance_after,
    p_campaign_id, p_idempotency_key, p_metadata
  )
  RETURNING id INTO tx_id;

  UPDATE public.credit_balances
  SET demo_balance = current_demo,
      bonus_balance = current_bonus,
      purchased_balance = current_purchased
  WHERE store_id = p_store_id;

  RETURN tx_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7.6 refund_credit — regra temporal com episódios de graça (D6/D25)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_credit(
  p_tx_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  store_id_var UUID;
  original_amount INTEGER;
  original_type TEXT;
  original_metadata JSONB;
  current_bonus INTEGER;
  current_purchased INTEGER;
  current_demo INTEGER;
  current_balance INTEGER;
  cur_demo_expires TIMESTAMPTZ;
  cur_demo_cycle UUID;
  cur_demo_origin UUID;
  cur_demo_contrib UUID[];
  refund_amount INTEGER;
  balance_before INTEGER;
  balance_after INTEGER;
  tx_id UUID;
  existing_tx_id UUID;
  duplicate_refund_id UUID;
  bonus_restore INTEGER;
  purchased_restore INTEGER;
  demo_restore INTEGER;
  v_origin UUID;
  v_new_demo_expires TIMESTAMPTZ;
  v_new_demo_cycle UUID;
  v_new_demo_contrib UUID[];
BEGIN
  SELECT store_id, amount, type, metadata
  INTO store_id_var, original_amount, original_type, original_metadata
  FROM public.credit_transactions
  WHERE id = p_tx_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transacao_nao_encontrada';
  END IF;

  IF original_type != 'deduction' THEN
    RAISE EXCEPTION 'tipo_invalido';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_tx_id
    FROM public.credit_transactions
    WHERE store_id = store_id_var AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF (SELECT type FROM public.credit_transactions WHERE id = existing_tx_id) = 'refund' THEN
        RETURN existing_tx_id;
      ELSE
        RAISE EXCEPTION 'idempotency_conflict';
      END IF;
    END IF;
  END IF;

  SELECT id INTO duplicate_refund_id
  FROM public.credit_transactions
  WHERE reference = p_tx_id::text AND type = 'refund';

  IF FOUND THEN
    RETURN duplicate_refund_id;
  END IF;

  demo_restore := COALESCE((original_metadata->>'demo_amount')::INTEGER, 0);
  bonus_restore := COALESCE((original_metadata->>'bonus_amount')::INTEGER, 0);
  purchased_restore := COALESCE((original_metadata->>'purchased_amount')::INTEGER, 0);

  IF (original_metadata->>'demo_amount') IS NULL
     AND (original_metadata->>'bonus_amount') IS NULL
     AND (original_metadata->>'purchased_amount') IS NULL THEN
    bonus_restore := ABS(original_amount);
    purchased_restore := 0;
    demo_restore := 0;
  END IF;

  -- Materializa expiração pendente (idempotente) na mesma transação
  PERFORM public.materialize_demo_expiration(store_id_var);

  SELECT balance, bonus_balance, purchased_balance, demo_balance, demo_expires_at, demo_cycle_id, origin_demo_grant_tx_id, demo_contributing_tx_ids
  INTO current_balance, current_bonus, current_purchased, current_demo, cur_demo_expires, cur_demo_cycle, cur_demo_origin, cur_demo_contrib
  FROM public.credit_balances
  WHERE store_id = store_id_var
  FOR UPDATE;

  v_origin := COALESCE(cur_demo_origin, (original_metadata->>'origin_demo_grant_tx_id')::UUID);

  v_new_demo_expires := cur_demo_expires;
  v_new_demo_cycle := cur_demo_cycle;
  v_new_demo_contrib := cur_demo_contrib;

  IF demo_restore > 0 THEN
    IF v_origin IS NULL THEN
      -- Sem grant original rastreável: defensivamente restaura como bônus
      bonus_restore := bonus_restore + demo_restore;
      demo_restore := 0;
    ELSIF cur_demo_expires IS NOT NULL AND cur_demo_expires > now() THEN
      -- Episódio ativo
      IF cur_demo_cycle IS DISTINCT FROM v_origin THEN
        -- Episódio de graça ativo: estende o prazo
        v_new_demo_expires := GREATEST(cur_demo_expires, now() + interval '24 hours');
      END IF;
      current_demo := current_demo + demo_restore;
    ELSE
      -- Nenhum episódio ativo: abre novo episódio de graça de 24h
      current_demo := current_demo + demo_restore;
      v_new_demo_expires := now() + interval '24 hours';
      v_new_demo_cycle := gen_random_uuid();
    END IF;
  END IF;

  refund_amount := demo_restore + bonus_restore + purchased_restore;
  balance_before := current_balance;
  balance_after := current_balance + refund_amount;
  current_bonus := current_bonus + bonus_restore;
  current_purchased := current_purchased + purchased_restore;

  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    reason, reference, idempotency_key, metadata
  ) VALUES (
    store_id_var, 'refund', refund_amount, balance_before, balance_after,
    p_reason, p_tx_id::text, p_idempotency_key,
    p_metadata || jsonb_build_object(
      'demo_amount', demo_restore,
      'bonus_amount', bonus_restore,
      'purchased_amount', purchased_restore,
      'origin_demo_grant_tx_id', v_origin
    )
  )
  RETURNING id INTO tx_id;

  IF demo_restore > 0 THEN
    IF v_new_demo_cycle IS DISTINCT FROM cur_demo_cycle THEN
      v_new_demo_contrib := ARRAY[v_origin, tx_id];
    ELSE
      v_new_demo_contrib := v_new_demo_contrib || tx_id;
    END IF;
  END IF;

  UPDATE public.credit_balances
  SET demo_balance = current_demo,
      demo_expires_at = v_new_demo_expires,
      demo_cycle_id = v_new_demo_cycle,
      origin_demo_grant_tx_id = v_origin,
      demo_contributing_tx_ids = v_new_demo_contrib,
      bonus_balance = current_bonus,
      purchased_balance = current_purchased
  WHERE store_id = store_id_var;

  RETURN tx_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7.8 wrappers demo — create_store_with_cnpj / update_store_cnpj / admin_approve_store_verification (D3/D8/D16)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_store_with_cnpj(TEXT, TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT[]);

CREATE OR REPLACE FUNCTION public.create_store_with_cnpj(
  p_cnpj_normalized TEXT,
  p_cnpj_root_hash TEXT,
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_accepted_by_user_id UUID,
  p_terms_version TEXT,
  p_acceptable_use_version TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_brand_color TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_subsegment TEXT DEFAULT NULL,
  p_tone_of_voice TEXT DEFAULT NULL,
  p_positioning TEXT DEFAULT NULL,
  p_short_description TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL,
  p_cnpj_validation_score JSONB DEFAULT NULL,
  p_razao_social TEXT DEFAULT NULL,
  p_nome_fantasia TEXT DEFAULT NULL,
  p_verification_status TEXT DEFAULT 'unverified',
  p_verification_data JSONB DEFAULT NULL,
  p_cnpj_official_data JSONB DEFAULT NULL,
  p_verification_reasons TEXT[] DEFAULT NULL,
  p_demo_grant_enabled BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_demo_grant JSONB;
  v_store_data JSONB;
BEGIN
  INSERT INTO public.stores (
    name, segment, user_id, city, state, brand_color, logo_url,
    subsegment, tone_of_voice, positioning, short_description, slogan,
    cnpj_normalized, cnpj_root_hash, cnpj_validation_score,
    razao_social, nome_fantasia,
    verification_status, verification_data, cnpj_official_data,
    verification_reasons, verification_requested_at
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan,
    p_cnpj_normalized, p_cnpj_root_hash, p_cnpj_validation_score,
    p_razao_social, p_nome_fantasia,
    p_verification_status, p_verification_data, p_cnpj_official_data,
    p_verification_reasons,
    CASE WHEN p_verification_status != 'unverified' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_store_id;

  INSERT INTO public.legal_acceptances (store_id, accepted_by_user_id, document_type, document_version, ip_address, user_agent, acceptance_source)
  VALUES
    (v_store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version, p_ip_address, p_user_agent, 'onboarding'),
    (v_store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version, p_ip_address, p_user_agent, 'onboarding');

  v_demo_grant := jsonb_build_object('granted', false);
  IF p_verification_status = 'approved' THEN
    v_demo_grant := public.grant_demo_credits(v_store_id, p_cnpj_root_hash, 10, p_demo_grant_enabled, 168, NULL, NULL);
  END IF;

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = v_store_id) s;

  RETURN jsonb_build_object(
    'store', v_store_data,
    'onboardingGranted', COALESCE((v_demo_grant->>'granted')::boolean, false),
    'verificationStatus', p_verification_status
  );
END;
$$;

DROP FUNCTION IF EXISTS public.update_store_cnpj(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, TEXT[]);

CREATE OR REPLACE FUNCTION public.update_store_cnpj(
  p_store_id UUID,
  p_cnpj_normalized TEXT,
  p_cnpj_root_hash TEXT,
  p_razao_social TEXT DEFAULT NULL,
  p_nome_fantasia TEXT DEFAULT NULL,
  p_cnpj_official_data JSONB DEFAULT NULL,
  p_verification_status TEXT DEFAULT 'unverified',
  p_verification_data JSONB DEFAULT NULL,
  p_cnpj_validation_score JSONB DEFAULT NULL,
  p_verification_reasons TEXT[] DEFAULT NULL,
  p_demo_grant_enabled BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_data JSONB;
  v_existing_hash TEXT;
  v_demo_grant JSONB;
  v_has_prior_benefit BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  SELECT cnpj_root_hash INTO v_existing_hash FROM public.stores WHERE id = p_store_id;
  IF v_existing_hash IS NOT NULL AND v_existing_hash != '' THEN
    RAISE EXCEPTION 'cnpj_already_set' USING HINT = 'Esta loja já possui CNPJ cadastrado';
  END IF;

  UPDATE public.stores SET
    cnpj_normalized = p_cnpj_normalized,
    cnpj_root_hash = p_cnpj_root_hash,
    razao_social = p_razao_social,
    nome_fantasia = p_nome_fantasia,
    cnpj_official_data = COALESCE(p_cnpj_official_data, cnpj_official_data),
    verification_status = p_verification_status,
    verification_data = COALESCE(p_verification_data, verification_data),
    cnpj_validation_score = COALESCE(p_cnpj_validation_score, cnpj_validation_score),
    verification_reasons = COALESCE(p_verification_reasons, verification_reasons),
    verification_requested_at = CASE
      WHEN p_verification_status != 'unverified' AND stores.verification_requested_at IS NULL
      THEN now()
      ELSE stores.verification_requested_at
    END
  WHERE id = p_store_id;

  -- Evidência real de benefício anterior (loja com bonus_onboarding OU raiz com onboarding)
  SELECT EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE store_id = p_store_id AND type = 'bonus_onboarding'
  ) OR EXISTS (
    SELECT 1 FROM public.freemium_entitlements
    WHERE root_hash = p_cnpj_root_hash AND benefit_type = 'onboarding'
  ) INTO v_has_prior_benefit;

  v_demo_grant := jsonb_build_object('granted', false);
  IF v_has_prior_benefit THEN
    -- Marcador legado: bloqueia demo futura, sem grant
    INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason)
    VALUES (p_store_id, p_cnpj_root_hash, 'onboarding', 'legacy_pre_f32_onboarding_consumed')
    ON CONFLICT (root_hash, benefit_type, (COALESCE(cycle, '_nostring_')))
    DO NOTHING;
  ELSIF p_verification_status = 'approved' THEN
    -- Loja draft elegível: concede a demonstração
    v_demo_grant := public.grant_demo_credits(p_store_id, p_cnpj_root_hash, 10, p_demo_grant_enabled, 168, NULL, NULL);
  END IF;

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object(
    'store', v_store_data,
    'onboardingGranted', COALESCE((v_demo_grant->>'granted')::boolean, false)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_approve_store_verification(UUID, UUID);

CREATE OR REPLACE FUNCTION public.admin_approve_store_verification(
  p_store_id UUID,
  p_admin_id UUID,
  p_demo_grant_enabled BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_root_hash TEXT;
  v_demo_grant JSONB;
  v_store_data JSONB;
BEGIN
  SELECT cnpj_root_hash INTO v_root_hash
  FROM public.stores WHERE id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  UPDATE public.stores SET
    verification_status = 'approved',
    verification_decided_at = now()
  WHERE id = p_store_id;

  v_demo_grant := jsonb_build_object('granted', false);
  IF v_root_hash IS NOT NULL AND v_root_hash != '' THEN
    v_demo_grant := public.grant_demo_credits(p_store_id, v_root_hash, 10, p_demo_grant_enabled, 168, NULL, p_admin_id);
  END IF;

  INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
  VALUES ('approve_verification', 'store', p_store_id, p_admin_id,
    'Aprovado manualmente por admin',
    jsonb_build_object('granted', COALESCE((v_demo_grant->>'granted')::boolean, false)));

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT id, verification_status, verification_decided_at FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object(
    'success', true,
    'onboardingGranted', COALESCE((v_demo_grant->>'granted')::boolean, false),
    'store', v_store_data
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7.9 admin_exception_store_verification — permanece bônus (D8), hardening
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_exception_store_verification(
  p_store_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_root_hash TEXT;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
  v_store_data JSONB;
BEGIN
  SELECT cnpj_root_hash INTO v_root_hash FROM public.stores WHERE id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  -- Raiz sintética POR LOJA (evita colisão no índice único entre lojas sem CNPJ)
  IF v_root_hash IS NULL OR v_root_hash = '' THEN
    v_root_hash := 'admin_exception_no_cnpj:' || p_store_id::text;
  END IF;

  UPDATE public.stores SET
    verification_status = 'approved',
    verification_decided_at = now()
  WHERE id = p_store_id;

  -- Idempotência: exceção já concedida para esta loja → sem novo grant
  SELECT id INTO v_entitlement_id
  FROM public.freemium_entitlements
  WHERE store_id = p_store_id AND benefit_type = 'admin_exception'
  LIMIT 1;

  IF v_entitlement_id IS NULL THEN
    INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason, granted_by)
    VALUES (p_store_id, v_root_hash, 'admin_exception', p_reason, p_admin_id)
    ON CONFLICT (root_hash, benefit_type, (COALESCE(cycle, '_nostring_')))
    DO NOTHING
    RETURNING id INTO v_entitlement_id;

    IF v_entitlement_id IS NOT NULL THEN
      SELECT public.grant_credits(
        p_store_id, 10, p_reason,
        'admin_exception_' || v_entitlement_id,
        jsonb_build_object('source', 'admin_exception', 'entitlement_id', v_entitlement_id),
        'admin_grant'
      ) INTO v_grant_tx_id;

      UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
      WHERE id = v_entitlement_id;
    END IF;
  END IF;

  INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
  VALUES ('admin_exception', 'store', p_store_id, p_admin_id, p_reason,
    jsonb_build_object(
      'grant_type', 'admin_exception',
      'entitlement_id', v_entitlement_id,
      'grant_transaction_id', v_grant_tx_id
    ));

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT id, verification_status, verification_decided_at FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object(
    'success', true,
    'onboardingGranted', v_grant_tx_id IS NOT NULL,
    'store', v_store_data
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7.10 create_store_with_initial_grant — neutraliza concessão sem CNPJ (D8)
--     (admin_create_store_for_user delega a esta função e, portanto, também deixa de conceder)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_store_with_initial_grant(
  p_name TEXT,
  p_segment TEXT,
  p_user_id UUID,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_brand_color TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_subsegment TEXT DEFAULT NULL,
  p_tone_of_voice TEXT DEFAULT NULL,
  p_positioning TEXT DEFAULT NULL,
  p_short_description TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL,
  p_initial_grant_amount INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_store_data JSONB;
BEGIN
  INSERT INTO public.stores (
    name, segment, user_id, city, state, brand_color, logo_url,
    subsegment, tone_of_voice, positioning, short_description, slogan
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan
  )
  RETURNING id INTO v_store_id;

  v_store_data := jsonb_build_object(
    'id', v_store_id,
    'name', p_name,
    'segment', p_segment,
    'balance', 0
  );
  RETURN v_store_data;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7.11 Privilégios mínimos (paridade F47/F48.1) — REVOKE PUBLIC + GRANT service_role
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.try_grant_demo_entitlement(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_grant_demo_entitlement(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.grant_demo_credits(UUID, TEXT, INTEGER, BOOLEAN, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_demo_credits(UUID, TEXT, INTEGER, BOOLEAN, INTEGER, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.materialize_demo_expiration(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_demo_expiration(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_credit(UUID, INTEGER, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credit(UUID, INTEGER, UUID, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.refund_credit(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credit(UUID, TEXT, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.create_store_with_cnpj(TEXT, TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT[], BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_with_cnpj(TEXT, TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT[], BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.update_store_cnpj(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, TEXT[], BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_cnpj(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, TEXT[], BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.admin_approve_store_verification(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_store_verification(UUID, UUID, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.admin_exception_store_verification(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exception_store_verification(UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.create_store_with_initial_grant(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_with_initial_grant(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

-- =============================================================================
-- REVERT (ordem reversa da criação)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 7. RPCs — REVERT (remover RPCs novas + restaurar versões anteriores)
-- -----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.grant_demo_credits(UUID, TEXT, INTEGER, BOOLEAN, INTEGER, TEXT, UUID);
-- DROP FUNCTION IF EXISTS public.try_grant_demo_entitlement(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.materialize_demo_expiration(UUID);

-- Restaurar grant_credits (6-param, sem demo) — ver 20260722000002_creditos_mensais_automaticos.sql (bloco 10):
-- DROP FUNCTION IF EXISTS public.grant_credits(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ);
-- CREATE OR REPLACE FUNCTION public.grant_credits(
--   p_store_id UUID, p_amount INTEGER, p_reason TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL,
--   p_metadata JSONB DEFAULT '{}'::jsonb, p_type TEXT DEFAULT 'admin_grant'
-- ) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
-- DECLARE balance_before INTEGER; balance_after INTEGER; tx_id UUID; existing_tx_id UUID; bonus_old INTEGER; purchased_old INTEGER;
-- BEGIN
--   IF p_amount <= 0 THEN RAISE EXCEPTION 'amount_invalido'; END IF;
--   IF p_idempotency_key IS NOT NULL THEN
--     SELECT id INTO existing_tx_id FROM public.credit_transactions WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
--     IF FOUND THEN
--       IF (SELECT type FROM public.credit_transactions WHERE id = existing_tx_id) IN ('bonus_onboarding','bonus_monthly','admin_grant','purchase') THEN RETURN existing_tx_id;
--       ELSE RAISE EXCEPTION 'idempotency_conflict'; END IF;
--     END IF;
--   END IF;
--   INSERT INTO public.credit_balances (store_id, balance) VALUES (p_store_id, 0) ON CONFLICT (store_id) DO NOTHING;
--   SELECT balance, bonus_balance, purchased_balance INTO balance_before, bonus_old, purchased_old FROM public.credit_balances WHERE store_id = p_store_id FOR UPDATE;
--   IF balance_before IS NULL THEN
--     INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance) VALUES (p_store_id, 0, 0, 0) ON CONFLICT (store_id) DO NOTHING;
--     balance_before := 0; bonus_old := 0; purchased_old := 0;
--   END IF;
--   IF p_type IN ('bonus_onboarding','bonus_monthly','admin_grant') THEN bonus_old := bonus_old + p_amount;
--   ELSIF p_type = 'purchase' THEN purchased_old := purchased_old + p_amount;
--   ELSE RAISE EXCEPTION 'tipo_invalido'; END IF;
--   balance_after := bonus_old + purchased_old;
--   INSERT INTO public.credit_transactions (store_id, type, amount, balance_before, balance_after, reason, idempotency_key, metadata)
--   VALUES (p_store_id, p_type, p_amount, balance_before, balance_after, p_reason, p_idempotency_key, p_metadata) RETURNING id INTO tx_id;
--   UPDATE public.credit_balances SET bonus_balance = bonus_old, purchased_balance = purchased_old WHERE store_id = p_store_id;
--   RETURN tx_id;
-- END; $$;

-- Restaurar reserve_credit (bônus→comprado, sem demo) — ver 20260722000002_creditos_mensais_automaticos.sql (bloco 11):
-- CREATE OR REPLACE FUNCTION public.reserve_credit(
--   p_store_id UUID, p_amount INTEGER, p_campaign_id UUID DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb
-- ) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
-- DECLARE current_bonus INTEGER; current_purchased INTEGER; balance_before INTEGER; balance_after INTEGER; tx_id UUID; existing_tx_id UUID;
--   amount_restante INTEGER; deduct_from_bonus INTEGER; deduct_from_purchased INTEGER;
-- BEGIN
--   IF p_amount <= 0 THEN RAISE EXCEPTION 'amount_invalido'; END IF;
--   IF p_idempotency_key IS NOT NULL THEN
--     SELECT id INTO existing_tx_id FROM public.credit_transactions WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
--     IF FOUND THEN
--       IF (SELECT type FROM public.credit_transactions WHERE id = existing_tx_id) = 'deduction' THEN RETURN existing_tx_id;
--       ELSE RAISE EXCEPTION 'idempotency_conflict'; END IF;
--     END IF;
--   END IF;
--   SELECT balance, bonus_balance, purchased_balance INTO balance_before, current_bonus, current_purchased FROM public.credit_balances WHERE store_id = p_store_id FOR UPDATE;
--   IF balance_before IS NULL THEN RAISE EXCEPTION 'saldo_inexistente'; END IF;
--   IF balance_before < p_amount THEN RAISE EXCEPTION 'saldo_insuficiente'; END IF;
--   amount_restante := p_amount;
--   deduct_from_bonus := LEAST(current_bonus, amount_restante); current_bonus := current_bonus - deduct_from_bonus; amount_restante := amount_restante - deduct_from_bonus;
--   deduct_from_purchased := LEAST(current_purchased, amount_restante); current_purchased := current_purchased - deduct_from_purchased; amount_restante := amount_restante - deduct_from_purchased;
--   IF amount_restante > 0 THEN RAISE EXCEPTION 'saldo_insuficiente'; END IF;
--   balance_after := current_bonus + current_purchased;
--   p_metadata := p_metadata || jsonb_build_object('bonus_amount', deduct_from_bonus, 'purchased_amount', deduct_from_purchased);
--   INSERT INTO public.credit_transactions (store_id, type, amount, balance_before, balance_after, campaign_id, idempotency_key, metadata)
--   VALUES (p_store_id, 'deduction', -p_amount, balance_before, balance_after, p_campaign_id, p_idempotency_key, p_metadata) RETURNING id INTO tx_id;
--   UPDATE public.credit_balances SET bonus_balance = current_bonus, purchased_balance = current_purchased WHERE store_id = p_store_id;
--   RETURN tx_id;
-- END; $$;

-- Restaurar refund_credit (bônus/comprado, sem demo) — ver 20260722000002_creditos_mensais_automaticos.sql (bloco 12):
-- CREATE OR REPLACE FUNCTION public.refund_credit(
--   p_tx_id UUID, p_reason TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb
-- ) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
-- DECLARE store_id_var UUID; original_amount INTEGER; original_type TEXT; original_metadata JSONB;
--   current_bonus INTEGER; current_purchased INTEGER; current_balance INTEGER; refund_amount INTEGER; balance_before INTEGER; balance_after INTEGER;
--   tx_id UUID; existing_tx_id UUID; duplicate_refund_id UUID; bonus_restore INTEGER; purchased_restore INTEGER;
-- BEGIN
--   SELECT store_id, amount, type, metadata INTO store_id_var, original_amount, original_type, original_metadata FROM public.credit_transactions WHERE id = p_tx_id FOR UPDATE;
--   IF NOT FOUND THEN RAISE EXCEPTION 'transacao_nao_encontrada'; END IF;
--   IF original_type != 'deduction' THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
--   IF p_idempotency_key IS NOT NULL THEN
--     SELECT id INTO existing_tx_id FROM public.credit_transactions WHERE store_id = store_id_var AND idempotency_key = p_idempotency_key;
--     IF FOUND THEN
--       IF (SELECT type FROM public.credit_transactions WHERE id = existing_tx_id) = 'refund' THEN RETURN existing_tx_id;
--       ELSE RAISE EXCEPTION 'idempotency_conflict'; END IF;
--     END IF;
--   END IF;
--   SELECT id INTO duplicate_refund_id FROM public.credit_transactions WHERE reference = p_tx_id::text AND type = 'refund';
--   IF FOUND THEN RETURN duplicate_refund_id; END IF;
--   SELECT balance, bonus_balance, purchased_balance INTO current_balance, current_bonus, current_purchased FROM public.credit_balances WHERE store_id = store_id_var FOR UPDATE;
--   bonus_restore := COALESCE((original_metadata->>'bonus_amount')::INTEGER, ABS(original_amount));
--   purchased_restore := COALESCE((original_metadata->>'purchased_amount')::INTEGER, 0);
--   IF (original_metadata->>'purchased_amount') IS NULL AND (original_metadata->>'bonus_amount') IS NULL THEN bonus_restore := ABS(original_amount); purchased_restore := 0; END IF;
--   refund_amount := bonus_restore + purchased_restore;
--   balance_before := current_balance; balance_after := current_balance + refund_amount;
--   current_bonus := current_bonus + bonus_restore; current_purchased := current_purchased + purchased_restore;
--   INSERT INTO public.credit_transactions (store_id, type, amount, balance_before, balance_after, reason, reference, idempotency_key, metadata)
--   VALUES (store_id_var, 'refund', refund_amount, balance_before, balance_after, p_reason, p_tx_id::text, p_idempotency_key, p_metadata) RETURNING id INTO tx_id;
--   UPDATE public.credit_balances SET bonus_balance = current_bonus, purchased_balance = current_purchased WHERE store_id = store_id_var;
--   RETURN tx_id;
-- END; $$;

-- Restaurar create_store_with_cnpj (26-param, sem p_demo_grant_enabled) — ver 20260728000001_f33_cnpj_verification.sql (bloco 8):
-- DROP FUNCTION IF EXISTS public.create_store_with_cnpj(TEXT, TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT[], BOOLEAN);
-- (recriar a assinatura de 26 parâmetros da F33, com a concessão bonus_onboarding via try_grant_onboarding_entitlement)

-- Restaurar update_store_cnpj (10-param, sem p_demo_grant_enabled) — ver 20260730000001_extend_update_store_cnpj.sql:
-- DROP FUNCTION IF EXISTS public.update_store_cnpj(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, TEXT[], BOOLEAN);
-- (recriar a assinatura de 10 parâmetros, com o marcador legacy incondicional)

-- Restaurar admin_approve_store_verification (2-param, sem p_demo_grant_enabled) — ver 20260728000002_fix_f33_audit_log.sql:
-- DROP FUNCTION IF EXISTS public.admin_approve_store_verification(UUID, UUID, BOOLEAN);
-- (recriar a assinatura de 2 parâmetros, com a concessão bonus_onboarding)

-- Restaurar admin_exception_store_verification (raiz sintética global + sem idempotência) — ver 20260728000001_f33_cnpj_verification.sql (bloco 7):
-- CREATE OR REPLACE FUNCTION public.admin_exception_store_verification(p_store_id UUID, p_admin_id UUID, p_reason TEXT) RETURNS JSONB ...

-- Restaurar create_store_with_initial_grant (com grant onboarding) — ver 20260914000002_f47_fix_admin_create_store_lint.sql:
-- CREATE OR REPLACE FUNCTION public.create_store_with_initial_grant(... p_initial_grant_amount INTEGER DEFAULT 10) RETURNS JSONB ...
--   (reinserir o PERFORM public.grant_credits(v_store_id, p_initial_grant_amount, 'onboarding', 'onboarding_' || v_store_id, '{}'::jsonb);)

-- Restaurar privilégios (desfazer REVOKE):
-- GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.reserve_credit(UUID, INTEGER, UUID, TEXT, JSONB) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.refund_credit(UUID, TEXT, TEXT, JSONB) TO PUBLIC;

-- -----------------------------------------------------------------------------
-- 1-6. Estrutural — REVERT
-- -----------------------------------------------------------------------------
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
