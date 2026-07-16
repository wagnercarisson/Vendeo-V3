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
