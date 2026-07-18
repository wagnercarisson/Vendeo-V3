-- Create admin_users table for admin access control
-- Separate table, not a flag in auth.users (avoid auth schema fragility)
-- Managed by service_role only; no authenticated role access

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.admin_users TO service_role;
GRANT INSERT ON TABLE public.admin_users TO service_role;
GRANT DELETE ON TABLE public.admin_users TO service_role;

-- Create admin_audit_log table (append-only audit trail for sensitive actions)
-- Every admin action (credit grant, store creation, etc.) MUST record an entry here
-- Immutable: UPDATE/DELETE blocked by trigger

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund')),
  target_type TEXT NOT NULL CHECK (target_type IN ('store', 'user', 'campaign')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  operation_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.admin_audit_log TO service_role;
GRANT INSERT ON TABLE public.admin_audit_log TO service_role;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON public.admin_audit_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON public.admin_audit_log (target_type, target_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_audit_log_operation
  ON public.admin_audit_log (operation_id)
  WHERE operation_id IS NOT NULL;

-- Immutable trigger: blocks UPDATE and DELETE on audit log (even service_role)
CREATE OR REPLACE FUNCTION public.trg_admin_audit_log_immutable_fn()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log é append-only. Nenhum UPDATE ou DELETE é permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_audit_log_immutable
BEFORE UPDATE OR DELETE ON public.admin_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.trg_admin_audit_log_immutable_fn();

-- =============================================================================
-- RPC: admin_grant_credits
-- Atomic: grant_credits + audit log in same transaction
-- Idempotent: same operation_id returns existing data without re-executing
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  p_actor_id UUID,
  p_store_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_operation_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_log RECORD;
  v_transaction_id UUID;
  v_balance INTEGER;
  v_result JSONB;
BEGIN
  -- Step 1: Idempotency check — same operation_id returns existing data
  IF p_operation_id IS NOT NULL THEN
    SELECT id, action, metadata INTO v_existing_log
    FROM public.admin_audit_log
    WHERE operation_id = p_operation_id;

    IF FOUND THEN
      SELECT COALESCE(balance, 0) INTO v_balance
      FROM public.credit_balances
      WHERE store_id = p_store_id;

      SELECT jsonb_build_object(
        'transaction_id', (v_existing_log.metadata ->> 'transaction_id'),
        'audit_id', v_existing_log.id,
        'idempotent', true,
        'newBalance', v_balance
      ) INTO v_result;

      RETURN v_result;
    END IF;
  END IF;

  -- Step 2: Grant credits via existing function
  v_transaction_id := public.grant_credits(
    p_store_id,
    p_amount,
    p_reason,
    'admin_grant_' || p_operation_id,
    p_metadata
  );

  -- Step 3: Insert audit log entry
  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id,
    metadata
  ) VALUES (
    p_actor_id, 'credit_grant', 'store', p_store_id, p_reason, p_operation_id,
    jsonb_build_object('amount', p_amount, 'transaction_id', v_transaction_id)
  );

  -- Step 4: Return result with current balance
  SELECT COALESCE(balance, 0) INTO v_balance
  FROM public.credit_balances
  WHERE store_id = p_store_id;

  SELECT jsonb_build_object(
    'transaction_id', v_transaction_id,
    'audit_id', (SELECT id FROM public.admin_audit_log WHERE operation_id = p_operation_id),
    'idempotent', false,
    'newBalance', v_balance
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- RPC: admin_create_store_for_user
-- Atomic: verification + store creation + audit log in same transaction
-- Raises exception if user already has a store
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_create_store_for_user(
  p_admin_id UUID,
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_store RECORD;
  v_store_data JSONB;
BEGIN
  -- Step 1: Verify user doesn't already have a store
  SELECT id, name INTO v_existing_store
  FROM public.stores
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'usuario_ja_possui_loja';
  END IF;

  -- Step 2: Create store with initial grant via existing RPC
  v_store_data := public.create_store_with_initial_grant(
    p_name := p_name,
    p_segment := p_segment,
    p_user_id := p_user_id
  );

  -- Step 3: Insert audit log entry
  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, metadata
  ) VALUES (
    p_admin_id, 'store_create_invite', 'user', p_user_id,
    'Criação de loja via admin (convite beta)',
    jsonb_build_object('storeId', v_store_data ->> 'id', 'storeName', p_name)
  );

  -- Step 4: Return store data
  RETURN v_store_data;
END;
$$;

-- =============================================================================
-- RPC: admin_get_users_summary
-- SECURITY DEFINER: accesses auth.users directly (not accessible via anon client)
-- Returns paginated user list with store, balance, and campaign data
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_users_summary(
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offset INTEGER;
  v_data JSONB;
  v_total BIGINT;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Count total matching records
  SELECT COUNT(*) INTO v_total
  FROM auth.users au
  LEFT JOIN public.stores s ON s.user_id = au.id
  WHERE (p_search IS NULL
    OR au.email ILIKE '%' || p_search || '%'
    OR s.name ILIKE '%' || p_search || '%'
    OR s.segment ILIKE '%' || p_search || '%');

  -- Fetch paginated data using a simpler approach with temp data
  SELECT COALESCE(jsonb_agg(user_data ORDER BY user_data->>'createdAt' DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT jsonb_build_object(
      'userId', u.id,
      'email', u.email,
      'storeId', st.id,
      'storeName', st.name,
      'segment', st.segment,
      'balance', COALESCE(cb.balance, 0),
      'totalCampaigns', COALESCE(c.cnt, 0),
      'errorCampaigns', COALESCE(ec.cnt, 0),
      'lastCampaignAt', cl.last_at,
      'createdAt', u.created_at
    ) AS user_data
    FROM auth.users u
    LEFT JOIN public.stores st ON st.user_id = u.id
    LEFT JOIN public.credit_balances cb ON cb.store_id = st.id
    LEFT JOIN (SELECT store_id, COUNT(*) AS cnt FROM public.campaigns GROUP BY store_id) c ON c.store_id = st.id
    LEFT JOIN (SELECT store_id, COUNT(*) AS cnt FROM public.campaigns WHERE status = 'error' GROUP BY store_id) ec ON ec.store_id = st.id
    LEFT JOIN (SELECT store_id, MAX(created_at) AS last_at FROM public.campaigns GROUP BY store_id) cl ON cl.store_id = st.id
    WHERE (p_search IS NULL
      OR u.email ILIKE '%' || p_search || '%'
      OR st.name ILIKE '%' || p_search || '%'
      OR st.segment ILIKE '%' || p_search || '%')
    ORDER BY u.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object('data', v_data, 'total', v_total);
END;
$$;

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.admin_get_users_summary CASCADE;
-- DROP FUNCTION IF EXISTS public.admin_create_store_for_user CASCADE;
-- DROP FUNCTION IF EXISTS public.admin_grant_credits CASCADE;
-- DROP TRIGGER IF EXISTS trg_admin_audit_log_immutable ON public.admin_audit_log;
-- DROP FUNCTION IF EXISTS public.trg_admin_audit_log_immutable_fn CASCADE;
-- DROP INDEX IF EXISTS idx_admin_audit_log_operation;
-- DROP INDEX IF EXISTS idx_admin_audit_log_target;
-- DROP INDEX IF EXISTS idx_admin_audit_log_actor;
-- REVOKE SELECT ON TABLE public.admin_audit_log FROM service_role;
-- REVOKE INSERT ON TABLE public.admin_audit_log FROM service_role;
-- REVOKE SELECT ON TABLE public.admin_users FROM service_role;
-- REVOKE INSERT ON TABLE public.admin_users FROM service_role;
-- REVOKE DELETE ON TABLE public.admin_users FROM service_role;
-- DROP TABLE IF EXISTS public.admin_audit_log CASCADE;
-- DROP TABLE IF EXISTS public.admin_users CASCADE;
