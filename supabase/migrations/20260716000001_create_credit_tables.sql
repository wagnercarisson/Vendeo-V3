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
