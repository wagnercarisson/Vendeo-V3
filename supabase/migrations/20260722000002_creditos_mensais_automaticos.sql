-- Créditos Mensais Automáticos (F29.3)
-- Expande credit_balances com buckets bônus/compra, reescreve SQL functions com lógica bucket-aware,
-- adiciona engine de concessão mensal com idempotência, teto e grant parcial.
-- Ordem obrigatória: colunas → desabilitar trigger → dropar constraints → backfill → constraints → triggers → índices → funções

-- =============================================================================
-- 1. Novas colunas em credit_balances (buckets de saldo)
-- =============================================================================
ALTER TABLE public.credit_balances ADD COLUMN bonus_balance INTEGER NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0);
ALTER TABLE public.credit_balances ADD COLUMN purchased_balance INTEGER NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0);
ALTER TABLE public.credit_balances ADD COLUMN last_monthly_grant_at TIMESTAMPTZ;

COMMENT ON COLUMN public.credit_balances.bonus_balance IS 'Saldo de bônus (onboarding, mensal, admin)';
COMMENT ON COLUMN public.credit_balances.purchased_balance IS 'Saldo de créditos comprados (F30)';
COMMENT ON COLUMN public.credit_balances.last_monthly_grant_at IS 'Última concessão mensal automática';

-- =============================================================================
-- 2. Desabilitar trigger imutável para permitir backfill
-- =============================================================================
DROP TRIGGER IF EXISTS trg_credit_transactions_immutable ON public.credit_transactions;

-- =============================================================================
-- 3. Dropar CHECK constraints para permitir UPDATE de tipos no backfill
-- =============================================================================
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS chk_credit_transactions_type;
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS chk_credit_transactions_amount_sign;

-- =============================================================================
-- 4. Backfill credit_balances — saldo existente vai para bônus
-- =============================================================================
UPDATE public.credit_balances SET bonus_balance = balance, purchased_balance = 0;

-- =============================================================================
-- 5. Backfill credit_transactions — recategorizar grants antigos
-- =============================================================================
UPDATE public.credit_transactions SET type = 'bonus_onboarding' WHERE type = 'grant' AND reason = 'onboarding';
UPDATE public.credit_transactions SET type = 'admin_grant' WHERE type = 'grant' AND reason IS DISTINCT FROM 'onboarding';

-- =============================================================================
-- 6. Recriar CHECK constraints com novos tipos
-- =============================================================================
ALTER TABLE public.credit_transactions ADD CONSTRAINT chk_credit_transactions_type
  CHECK (type = ANY (ARRAY['bonus_onboarding'::text, 'bonus_monthly'::text, 'admin_grant'::text, 'purchase'::text, 'deduction'::text, 'refund'::text, 'adjustment'::text]));

ALTER TABLE public.credit_transactions ADD CONSTRAINT chk_credit_transactions_amount_sign
  CHECK (
    (type IN ('bonus_onboarding', 'bonus_monthly', 'admin_grant', 'purchase', 'refund') AND amount > 0)
    OR (type = 'deduction' AND amount < 0)
    OR (type = 'adjustment' AND amount <> 0)
  );

-- =============================================================================
-- 7. Reabilitar trigger imutável
-- =============================================================================
CREATE TRIGGER trg_credit_transactions_immutable
  BEFORE UPDATE OR DELETE ON public.credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_credit_transactions_immutable_fn();

-- =============================================================================
-- 8. Trigger de sincronização sync_credit_balances_total
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_credit_balances_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance := NEW.bonus_balance + NEW.purchased_balance;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_balances_sync_total
  BEFORE INSERT OR UPDATE ON public.credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_credit_balances_total();

-- =============================================================================
-- 9. Índice parcial para concessão mensal
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_credit_balances_monthly_grant
  ON public.credit_balances (last_monthly_grant_at)
  WHERE last_monthly_grant_at IS NOT NULL;

-- =============================================================================
-- 10. Reescrever grant_credits com p_type (bucket-aware)
-- =============================================================================
DROP FUNCTION IF EXISTS public.grant_credits(UUID, INTEGER, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.grant_credits(
  p_store_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_type TEXT DEFAULT 'admin_grant'
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
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalido';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_tx_id
    FROM public.credit_transactions
    WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF (SELECT type FROM public.credit_transactions WHERE id = existing_tx_id) IN ('bonus_onboarding', 'bonus_monthly', 'admin_grant', 'purchase') THEN
        RETURN existing_tx_id;
      ELSE
        RAISE EXCEPTION 'idempotency_conflict';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.credit_balances (store_id, balance)
  VALUES (p_store_id, 0)
  ON CONFLICT (store_id) DO NOTHING;

  SELECT balance, bonus_balance, purchased_balance
  INTO balance_before, bonus_old, purchased_old
  FROM public.credit_balances
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF balance_before IS NULL THEN
    INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance)
    VALUES (p_store_id, 0, 0, 0)
    ON CONFLICT (store_id) DO NOTHING;
    balance_before := 0;
    bonus_old := 0;
    purchased_old := 0;
  END IF;

  IF p_type IN ('bonus_onboarding', 'bonus_monthly', 'admin_grant') THEN
    bonus_old := bonus_old + p_amount;
  ELSIF p_type = 'purchase' THEN
    purchased_old := purchased_old + p_amount;
  ELSE
    RAISE EXCEPTION 'tipo_invalido';
  END IF;

  balance_after := bonus_old + purchased_old;

  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    reason, idempotency_key, metadata
  ) VALUES (
    p_store_id, p_type, p_amount, balance_before, balance_after,
    p_reason, p_idempotency_key, p_metadata
  )
  RETURNING id INTO tx_id;

  UPDATE public.credit_balances
  SET bonus_balance = bonus_old,
      purchased_balance = purchased_old
  WHERE store_id = p_store_id;

  RETURN tx_id;
END;
$$;

-- =============================================================================
-- 11. Reescrever reserve_credit bucket-aware (bônus primeiro)
-- =============================================================================
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
  balance_before INTEGER;
  balance_after INTEGER;
  tx_id UUID;
  existing_tx_id UUID;
  amount_restante INTEGER;
  deduct_from_bonus INTEGER;
  deduct_from_purchased INTEGER;
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

  SELECT balance, bonus_balance, purchased_balance
  INTO balance_before, current_bonus, current_purchased
  FROM public.credit_balances
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF balance_before IS NULL THEN
    RAISE EXCEPTION 'saldo_inexistente';
  END IF;

  IF balance_before < p_amount THEN
    RAISE EXCEPTION 'saldo_insuficiente';
  END IF;

  -- Dedução prioritária: bônus primeiro, comprado por último
  amount_restante := p_amount;
  deduct_from_bonus := LEAST(current_bonus, amount_restante);
  current_bonus := current_bonus - deduct_from_bonus;
  amount_restante := amount_restante - deduct_from_bonus;
  deduct_from_purchased := LEAST(current_purchased, amount_restante);
  current_purchased := current_purchased - deduct_from_purchased;
  amount_restante := amount_restante - deduct_from_purchased;
  IF amount_restante > 0 THEN
    RAISE EXCEPTION 'saldo_insuficiente';
  END IF;

  balance_after := current_bonus + current_purchased;

  p_metadata := p_metadata || jsonb_build_object(
    'bonus_amount', deduct_from_bonus,
    'purchased_amount', deduct_from_purchased
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
  SET bonus_balance = current_bonus,
      purchased_balance = current_purchased
  WHERE store_id = p_store_id;

  RETURN tx_id;
END;
$$;

-- =============================================================================
-- 12. Reescrever refund_credit bucket-aware (lê metadata da deduction)
-- =============================================================================
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
  current_balance INTEGER;
  refund_amount INTEGER;
  balance_before INTEGER;
  balance_after INTEGER;
  tx_id UUID;
  existing_tx_id UUID;
  duplicate_refund_id UUID;
  bonus_restore INTEGER;
  purchased_restore INTEGER;
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

  SELECT balance, bonus_balance, purchased_balance
  INTO current_balance, current_bonus, current_purchased
  FROM public.credit_balances
  WHERE store_id = store_id_var
  FOR UPDATE;

  -- Extrair valores dos buckets da metadata original da deduction
  bonus_restore := COALESCE((original_metadata->>'bonus_amount')::INTEGER, ABS(original_amount));
  purchased_restore := COALESCE((original_metadata->>'purchased_amount')::INTEGER, 0);

  -- Se metadata não tem purchased_amount (deduction legacy), fallback: todo valor é bônus
  IF (original_metadata->>'purchased_amount') IS NULL AND (original_metadata->>'bonus_amount') IS NULL THEN
    bonus_restore := ABS(original_amount);
    purchased_restore := 0;
  END IF;

  refund_amount := bonus_restore + purchased_restore;
  balance_before := current_balance;
  balance_after := current_balance + refund_amount;
  current_bonus := current_bonus + bonus_restore;
  current_purchased := current_purchased + purchased_restore;

  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    reason, reference, idempotency_key, metadata
  ) VALUES (
    store_id_var, 'refund', refund_amount, balance_before, balance_after,
    p_reason, p_tx_id::text, p_idempotency_key, p_metadata
  )
  RETURNING id INTO tx_id;

  UPDATE public.credit_balances
  SET bonus_balance = current_bonus,
      purchased_balance = current_purchased
  WHERE store_id = store_id_var;

  RETURN tx_id;
END;
$$;

-- =============================================================================
-- 13. RPC grant_monthly_credits — concessão mensal automática
-- =============================================================================
CREATE OR REPLACE FUNCTION public.grant_monthly_credits(
  p_amount INTEGER,
  p_bonus_cap INTEGER,
  p_min_store_age_days INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rec RECORD;
  grant_amount INTEGER;
  ciclo INTEGER;
  idempotency_key TEXT;
  eligible_count INTEGER := 0;
  granted_count INTEGER := 0;
  skipped_count INTEGER := 0;
  error_count INTEGER := 0;
  ciclo_floor BIGINT;
BEGIN
  -- Pré-contagem de elegíveis: lojas com idade >= min_store_age_days
  -- E que nunca receberam grant mensal OU receberam há mais de min_store_age_days
  SELECT COUNT(*) INTO eligible_count
  FROM public.stores s
  LEFT JOIN public.credit_balances cb ON cb.store_id = s.id
  WHERE s.created_at <= NOW() - make_interval(days => p_min_store_age_days)
    AND (cb.last_monthly_grant_at IS NULL OR cb.last_monthly_grant_at < NOW() - make_interval(days => p_min_store_age_days));

  -- Etapa 1: Inserir credit_balances com zeros para lojas elegíveis sem row
  INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance)
  SELECT s.id, 0, 0, 0
  FROM public.stores s
  WHERE s.created_at <= NOW() - make_interval(days => p_min_store_age_days)
    AND NOT EXISTS (SELECT 1 FROM public.credit_balances cb WHERE cb.store_id = s.id)
  ON CONFLICT (store_id) DO NOTHING;

  -- Etapa 2: Processar lojas elegíveis abaixo do cap com SKIP LOCKED
  FOR rec IN
    SELECT s.id AS store_id, s.created_at, COALESCE(cb.bonus_balance, 0) AS current_bonus
    FROM public.stores s
    JOIN public.credit_balances cb ON cb.store_id = s.id
    WHERE s.created_at <= NOW() - make_interval(days => p_min_store_age_days)
      AND (cb.last_monthly_grant_at IS NULL OR cb.last_monthly_grant_at < NOW() - make_interval(days => p_min_store_age_days))
      AND cb.bonus_balance < p_bonus_cap
    ORDER BY s.id
    FOR UPDATE OF cb SKIP LOCKED
  LOOP
    -- Calcular ciclo efetivo (30 dias desde criação)
    ciclo_floor := FLOOR(EXTRACT(EPOCH FROM (NOW() - rec.created_at)) / (30 * 86400));
    ciclo := ciclo_floor::INTEGER;

    -- Chave de idempotência baseada em ciclos de 30 dias
    idempotency_key := 'mensal_ciclo_' || ciclo || '_' || rec.store_id;

    -- Grant parcial: o mínimo entre amount e o espaço até o cap
    grant_amount := LEAST(p_amount, p_bonus_cap - rec.current_bonus);

    BEGIN
      PERFORM public.grant_credits(
        rec.store_id,
        grant_amount,
        'mensal',
        idempotency_key,
        jsonb_build_object('cycle', ciclo, 'grant_type', 'bonus_monthly'),
        'bonus_monthly'
      );

      -- Atualizar last_monthly_grant_at apenas se houve grant efetivo
      UPDATE public.credit_balances
      SET last_monthly_grant_at = NOW()
      WHERE store_id = rec.store_id;

      granted_count := granted_count + 1;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
    END;
  END LOOP;

  -- Lojas elegíveis no cap (skipped)
  SELECT COUNT(*) INTO skipped_count
  FROM public.stores s
  JOIN public.credit_balances cb ON cb.store_id = s.id
  WHERE s.created_at <= NOW() - make_interval(days => p_min_store_age_days)
    AND (cb.last_monthly_grant_at IS NULL OR cb.last_monthly_grant_at < NOW() - make_interval(days => p_min_store_age_days))
    AND cb.bonus_balance >= p_bonus_cap;

  RETURN jsonb_build_object(
    'eligible', eligible_count,
    'granted', granted_count,
    'skipped', skipped_count,
    'errors', error_count
  );
END;
$$;

-- =============================================================================
-- REVERT
-- =============================================================================
-- Ordem reversa: funções → índice → triggers → constraints → backfill → colunas
--
-- DROP FUNCTION IF EXISTS public.grant_monthly_credits(INTEGER, INTEGER, INTEGER);
-- DROP FUNCTION IF EXISTS public.grant_credits(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT);
-- DROP FUNCTION IF EXISTS public.reserve_credit(UUID, INTEGER, UUID, TEXT, JSONB);
-- DROP FUNCTION IF EXISTS public.refund_credit(UUID, TEXT, TEXT, JSONB);
-- DROP INDEX IF EXISTS idx_credit_balances_monthly_grant;
-- DROP TRIGGER IF EXISTS trg_credit_balances_sync_total ON public.credit_balances;
-- DROP FUNCTION IF EXISTS public.sync_credit_balances_total;
-- DROP TRIGGER IF EXISTS trg_credit_transactions_immutable ON public.credit_transactions;
--
-- ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS chk_credit_transactions_type;
-- ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS chk_credit_transactions_amount_sign;
-- ALTER TABLE public.credit_transactions ADD CONSTRAINT chk_credit_transactions_type CHECK (type IN ('grant','purchase','deduction','refund','adjustment'));
-- ALTER TABLE public.credit_transactions ADD CONSTRAINT chk_credit_transactions_amount_sign CHECK (
--   (type IN ('grant','purchase','refund') AND amount > 0)
--   OR (type = 'deduction' AND amount < 0)
--   OR (type = 'adjustment' AND amount <> 0)
-- );
--
-- CREATE TRIGGER trg_credit_transactions_immutable
--   BEFORE UPDATE OR DELETE ON public.credit_transactions
--   FOR EACH ROW
--   EXECUTE FUNCTION public.trg_credit_transactions_immutable_fn();
--
-- ALTER TABLE public.credit_balances DROP COLUMN IF EXISTS last_monthly_grant_at;
-- ALTER TABLE public.credit_balances DROP COLUMN IF EXISTS purchased_balance;
-- ALTER TABLE public.credit_balances DROP COLUMN IF EXISTS bonus_balance;
