-- Create credit_balances table for store credit wallet
-- Each store has exactly one balance row
-- Balance is enforced non-negative via CHECK constraint
-- Uses per-table scoped trigger function (NOT generic)

CREATE TABLE IF NOT EXISTS public.credit_balances (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Specific trigger function for this table (NOT a generic one per project convention)
CREATE OR REPLACE FUNCTION public.update_credit_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on row change
CREATE TRIGGER trg_credit_balances_updated_at
BEFORE UPDATE ON public.credit_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_credit_balances_updated_at();

-- Enable Row Level Security
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;

-- Owner SELECT policy: owner can see only their own store's balance
CREATE POLICY "owner_select_credit_balances" ON public.credit_balances
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())));

-- GRANT SELECT necessary for RLS to work with authenticated role
-- INSERT/UPDATE/DELETE grants explicitly omitted — mutations via SQL functions (service_role only)
GRANT SELECT ON TABLE public.credit_balances TO authenticated;

-- Create credit_transactions table (append-only ledger)
-- Each transaction records balance_before and balance_after for linear reconciliation
-- Append-only enforced at DB level: UPDATE/DELETE blocked by immutable trigger
-- Idempotency via partial unique index on (store_id, idempotency_key) WHERE NOT NULL

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  reason TEXT,
  reference TEXT,
  idempotency_key TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Enforce valid transaction types
  CONSTRAINT chk_credit_transactions_type CHECK (type IN ('grant','purchase','deduction','refund','adjustment')),

  -- Enforce amount sign by type:
  -- grant/purchase/refund > 0, deduction < 0, adjustment <> 0
  CONSTRAINT chk_credit_transactions_amount_sign CHECK (
    (type IN ('grant','purchase','refund') AND amount > 0)
    OR (type = 'deduction' AND amount < 0)
    OR (type = 'adjustment' AND amount <> 0)
  ),

  -- Enforce non-negative balances at insert time
  CONSTRAINT chk_credit_transactions_balance_non_negative CHECK (
    balance_before >= 0 AND balance_after >= 0
  ),

  -- Enforce amount is never zero (adjustment handles sign via <> 0)
  CONSTRAINT chk_credit_transactions_amount_non_zero CHECK (amount <> 0)
);

-- Partial unique index for idempotency: (store_id, idempotency_key) where key is not null
-- Allows multiple NULL idempotency_keys while enforcing uniqueness for non-null ones
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_idempotency
  ON public.credit_transactions (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Index for per-store chronological queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_credit_transactions_store_id
  ON public.credit_transactions (store_id, created_at DESC);

-- Immutable trigger function: blocks UPDATE and DELETE on ledger
CREATE OR REPLACE FUNCTION public.trg_credit_transactions_immutable_fn()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'credit_transactions é append-only';
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce append-only (blocks even service_role)
CREATE TRIGGER trg_credit_transactions_immutable
BEFORE UPDATE OR DELETE ON public.credit_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trg_credit_transactions_immutable_fn();

-- Enable Row Level Security
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Owner SELECT policy: owner can see only their own store's transactions
CREATE POLICY "owner_select_credit_transactions" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())));

-- GRANT SELECT necessary for RLS to work with authenticated role
-- INSERT/UPDATE/DELETE grants explicitly omitted — mutations via SQL functions (service_role only)
GRANT SELECT ON TABLE public.credit_transactions TO authenticated;

-- =============================================================================
-- SQL Functions (Atomic Mutations with SELECT FOR UPDATE + Idempotency)
-- =============================================================================

-- grant_credits(store_id, amount, reason, idempotency_key, metadata) → UUID
-- Grants credits to a store's wallet. Creates credit_balances row if not exists.
-- Idempotent: same (store_id, idempotency_key) returns existing tx UUID.
-- Atomic: SELECT ... FOR UPDATE within single transaction.
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_store_id UUID,
  p_amount INTEGER,
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
  balance_before INTEGER;
  balance_after INTEGER;
  tx_id UUID;
  existing_tx_id UUID;
BEGIN
  -- Validate amount > 0
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalido';
  END IF;

  -- Idempotency check: if idempotency_key provided, look for existing transaction
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_tx_id
    FROM public.credit_transactions
    WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      -- Check if existing transaction has same type (grant)
      IF (SELECT type FROM public.credit_transactions WHERE id = existing_tx_id) = 'grant' THEN
        RETURN existing_tx_id;
      ELSE
        RAISE EXCEPTION 'idempotency_conflict';
      END IF;
    END IF;
  END IF;

  -- Ensure credit_balances row exists (INSERT ON CONFLICT DO NOTHING)
  INSERT INTO public.credit_balances (store_id, balance)
  VALUES (p_store_id, 0)
  ON CONFLICT (store_id) DO NOTHING;

  -- Lock row and read current balance
  SELECT balance INTO balance_before
  FROM public.credit_balances
  WHERE store_id = p_store_id
  FOR UPDATE;

  -- If still null (shouldn't happen after INSERT ON CONFLICT), initialize
  IF balance_before IS NULL THEN
    INSERT INTO public.credit_balances (store_id, balance)
    VALUES (p_store_id, 0)
    ON CONFLICT (store_id) DO NOTHING;
    balance_before := 0;
  END IF;

  -- Calculate new balance
  balance_after := balance_before + p_amount;

  -- Insert transaction record
  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    reason, idempotency_key, metadata
  ) VALUES (
    p_store_id, 'grant', p_amount, balance_before, balance_after,
    p_reason, p_idempotency_key, p_metadata
  )
  RETURNING id INTO tx_id;

  -- Update balance
  UPDATE public.credit_balances
  SET balance = balance_after
  WHERE store_id = p_store_id;

  RETURN tx_id;
END;
$$;

-- reserve_credit(store_id, amount, campaign_id, idempotency_key, metadata) → UUID
-- Reserves (deducts) credits from a store's wallet for campaign generation.
-- Requires sufficient balance, raises saldo_insuficiente if not.
-- Idempotent: same (store_id, idempotency_key) returns existing deduction UUID.
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
  current_balance INTEGER;
  balance_before INTEGER;
  balance_after INTEGER;
  tx_id UUID;
  existing_tx_id UUID;
BEGIN
  -- Validate amount > 0
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalido';
  END IF;

  -- Idempotency check
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

  -- Lock row and read current balance
  SELECT balance INTO current_balance
  FROM public.credit_balances
  WHERE store_id = p_store_id
  FOR UPDATE;

  -- Check if store has a credit_balances record
  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'saldo_inexistente';
  END IF;

  -- Check if sufficient balance
  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'saldo_insuficiente';
  END IF;

  -- Calculate balances (amount stored as negative in the transaction)
  balance_before := current_balance;
  balance_after := current_balance - p_amount;

  -- Insert deduction transaction (negative amount)
  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    campaign_id, idempotency_key, metadata
  ) VALUES (
    p_store_id, 'deduction', -p_amount, balance_before, balance_after,
    p_campaign_id, p_idempotency_key, p_metadata
  )
  RETURNING id INTO tx_id;

  -- Update balance
  UPDATE public.credit_balances
  SET balance = balance_after
  WHERE store_id = p_store_id;

  RETURN tx_id;
END;
$$;

-- refund_credit(tx_id, reason, idempotency_key, metadata) → UUID
-- Refunds (reverses) a deduction transaction, restoring the balance.
-- Validates original transaction exists and is type 'deduction'.
-- Idempotent: duplicate refund of same tx (via reference) or same idempotency_key returns existing refund UUID.
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
  current_balance INTEGER;
  refund_amount INTEGER;
  balance_before INTEGER;
  balance_after INTEGER;
  tx_id UUID;
  existing_tx_id UUID;
  duplicate_refund_id UUID;
BEGIN
  -- Look up original transaction with lock
  SELECT store_id, amount, type
  INTO store_id_var, original_amount, original_type
  FROM public.credit_transactions
  WHERE id = p_tx_id
  FOR UPDATE;

  -- Check if transaction exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transacao_nao_encontrada';
  END IF;

  -- Validate original transaction is a deduction
  IF original_type != 'deduction' THEN
    RAISE EXCEPTION 'tipo_invalido';
  END IF;

  -- Idempotency check: same idempotency_key
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

  -- Duplicate refund check: look for existing refund referencing the original tx
  SELECT id INTO duplicate_refund_id
  FROM public.credit_transactions
  WHERE reference = p_tx_id::text AND type = 'refund';

  IF FOUND THEN
    RETURN duplicate_refund_id;
  END IF;

  -- Lock balance row
  SELECT balance INTO current_balance
  FROM public.credit_balances
  WHERE store_id = store_id_var
  FOR UPDATE;

  -- Calculate refund amount (absolute value of original deduction)
  refund_amount := ABS(original_amount);

  -- Calculate balances
  balance_before := current_balance;
  balance_after := current_balance + refund_amount;

  -- Insert refund transaction (positive amount)
  INSERT INTO public.credit_transactions (
    store_id, type, amount, balance_before, balance_after,
    reason, reference, idempotency_key, metadata
  ) VALUES (
    store_id_var, 'refund', refund_amount, balance_before, balance_after,
    p_reason, p_tx_id::text, p_idempotency_key, p_metadata
  )
  RETURNING id INTO tx_id;

  -- Update balance
  UPDATE public.credit_balances
  SET balance = balance_after
  WHERE store_id = store_id_var;

  RETURN tx_id;
END;
$$;

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.refund_credit CASCADE;
-- DROP FUNCTION IF EXISTS public.reserve_credit CASCADE;
-- DROP FUNCTION IF EXISTS public.grant_credits CASCADE;
-- DROP TABLE IF EXISTS public.credit_transactions CASCADE;
-- DROP TABLE IF EXISTS public.credit_balances CASCADE;
-- DROP FUNCTION IF EXISTS public.trg_credit_transactions_immutable_fn CASCADE;
-- DROP TRIGGER IF EXISTS trg_credit_transactions_immutable ON public.credit_transactions;
-- DROP TRIGGER IF EXISTS trg_credit_balances_updated_at ON public.credit_balances;
-- DROP FUNCTION IF EXISTS public.update_credit_balances_updated_at CASCADE;
-- REVOKE SELECT ON TABLE public.credit_transactions FROM authenticated;
-- REVOKE SELECT ON TABLE public.credit_balances FROM authenticated;
-- DROP POLICY IF EXISTS "owner_select_credit_transactions" ON public.credit_transactions;
-- DROP POLICY IF EXISTS "owner_select_credit_balances" ON public.credit_balances;
-- ALTER TABLE public.credit_transactions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.credit_balances DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS idx_credit_transactions_store_id;
-- DROP INDEX IF EXISTS idx_credit_transactions_idempotency;
