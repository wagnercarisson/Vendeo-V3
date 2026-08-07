-- F38 — Tabela de Custos por Operação (fonte única de custo em créditos)
-- =============================================================================
-- Cria a fonte única de custo por operação no banco:
--   - credit_operation_costs (D2/D3): operation_key PK, cost_credits > 0, enabled
--   - credit_operation_cost_audit (D8): append-only old/new, idempotência por operation_id
--   - RPC admin_update_operation_cost (definer, XOR, transacional, idempotente)
--   - Seeds de sistema: campaign_generation=1, visual_signature_generation=1
--
-- Regras:
--   - Sem GRANT para authenticated (cliente não lê diretamente — D2)
--   - Sem CHECK enum no banco (chaves versionadas no TS — D7)
--   - reserve_credit (F24) permanece INALTERADO (D6)
--   - XOR: exatamente um de p_cost_credits / p_enabled por chamada
--
-- Blocos:
--   1. Tabela credit_operation_costs + trigger updated_at
--   2. Tabela credit_operation_cost_audit + índice idempotência + trigger imutável
--   3. RLS + REVOKE/GRANT (service_role only)
--   4. RPC admin_update_operation_cost + REVOKE/GRANT
--   5. Seeds de sistema
--   6. REVERT (comentado)

-- =============================================================================
-- 1. Tabela credit_operation_costs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.credit_operation_costs (
  operation_key    TEXT PRIMARY KEY,
  cost_credits     INTEGER NOT NULL CHECK (cost_credits > 0),
  enabled          BOOLEAN NOT NULL DEFAULT true,
  updated_by       UUID REFERENCES auth.users(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Specific trigger function for this table (NOT a generic one per project convention)
CREATE OR REPLACE FUNCTION public.update_credit_operation_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_operation_costs_updated_at
BEFORE UPDATE ON public.credit_operation_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_credit_operation_costs_updated_at();

-- =============================================================================
-- 2. Tabela credit_operation_cost_audit (append-only)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.credit_operation_cost_audit (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key    TEXT NOT NULL,
  action           TEXT NOT NULL CHECK (action IN ('update_cost', 'toggle_enabled')),
  old_cost_credits INTEGER,
  new_cost_credits INTEGER,
  old_enabled      BOOLEAN,
  new_enabled      BOOLEAN,
  actor_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason           TEXT NOT NULL,
  operation_id     UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index for idempotency: operation_id where not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_operation_cost_audit_idempotency
  ON public.credit_operation_cost_audit (operation_id)
  WHERE operation_id IS NOT NULL;

-- Immutable trigger: blocks UPDATE and DELETE on audit (even service_role)
CREATE OR REPLACE FUNCTION public.trg_credit_operation_cost_audit_immutable_fn()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'credit_operation_cost_audit é append-only. Nenhum UPDATE ou DELETE é permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_operation_cost_audit_immutable
BEFORE UPDATE OR DELETE ON public.credit_operation_cost_audit
FOR EACH ROW
EXECUTE FUNCTION public.trg_credit_operation_cost_audit_immutable_fn();

-- =============================================================================
-- 3. RLS + grants (service_role only — sem GRANT para authenticated)
-- =============================================================================
ALTER TABLE public.credit_operation_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_operation_cost_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.credit_operation_costs FROM anon, authenticated;
REVOKE ALL ON TABLE public.credit_operation_cost_audit FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.credit_operation_costs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.credit_operation_cost_audit TO service_role;

-- =============================================================================
-- 4. RPC admin_update_operation_cost
-- Atomic: UPDATE cost/enabled + INSERT audit in same transaction
-- Idempotent: same operation_id returns existing audit without re-executing
-- XOR: exactly one of p_cost_credits / p_enabled per call
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_operation_cost(
  p_actor_id UUID,
  p_operation_key TEXT,
  p_cost_credits INTEGER DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_audit RECORD;
  v_old_cost INTEGER;
  v_old_enabled BOOLEAN;
  v_new_cost INTEGER;
  v_new_enabled BOOLEAN;
  v_action TEXT;
  v_audit_id UUID;
  v_result JSONB;
BEGIN
  -- Step 0a: reason and operation_key required
  IF p_operation_key IS NULL OR p_reason IS NULL THEN
    RAISE EXCEPTION 'operation_cost_reason_required';
  END IF;

  -- Step 0b: XOR — exactly one mutable field
  IF (p_cost_credits IS NULL) = (p_enabled IS NULL) THEN
    RAISE EXCEPTION 'operation_cost_xor_violation';
  END IF;

  -- Step 1: Idempotency — same operation_id returns existing audit snapshot
  IF p_operation_id IS NOT NULL THEN
    SELECT id, new_cost_credits, new_enabled, created_at
    INTO v_existing_audit
    FROM public.credit_operation_cost_audit
    WHERE operation_id = p_operation_id;

    IF FOUND THEN
      SELECT jsonb_build_object(
        'operation_key', p_operation_key,
        'cost_credits', v_existing_audit.new_cost_credits,
        'enabled', v_existing_audit.new_enabled,
        'audit_id', v_existing_audit.id,
        'updated_at', v_existing_audit.created_at,
        'idempotent', true
      ) INTO v_result;
      RETURN v_result;
    END IF;
  END IF;

  -- Step 2: Capture old values (RPC does NOT create keys — D7 enum is TS-versioned)
  SELECT cost_credits, enabled
  INTO v_old_cost, v_old_enabled
  FROM public.credit_operation_costs
  WHERE operation_key = p_operation_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'operation_key_not_found';
  END IF;

  -- Step 3: Validate cost when mutating cost_credits
  IF p_cost_credits IS NOT NULL AND p_cost_credits <= 0 THEN
    RAISE EXCEPTION 'operation_cost_invalid';
  END IF;

  -- Step 4: UPDATE exactly one field + actor
  IF p_cost_credits IS NOT NULL THEN
    v_action := 'update_cost';
    v_new_cost := p_cost_credits;
    v_new_enabled := v_old_enabled;

    UPDATE public.credit_operation_costs
    SET cost_credits = p_cost_credits,
        updated_by = p_actor_id
    WHERE operation_key = p_operation_key;
  ELSE
    v_action := 'toggle_enabled';
    v_new_cost := v_old_cost;
    v_new_enabled := p_enabled;

    UPDATE public.credit_operation_costs
    SET enabled = p_enabled,
        updated_by = p_actor_id
    WHERE operation_key = p_operation_key;
  END IF;

  -- Step 5: INSERT audit with full old/new snapshot of both axes
  INSERT INTO public.credit_operation_cost_audit (
    operation_key,
    action,
    old_cost_credits,
    new_cost_credits,
    old_enabled,
    new_enabled,
    actor_id,
    reason,
    operation_id
  ) VALUES (
    p_operation_key,
    v_action,
    v_old_cost,
    v_new_cost,
    v_old_enabled,
    v_new_enabled,
    p_actor_id,
    p_reason,
    p_operation_id
  )
  RETURNING id INTO v_audit_id;

  -- Step 6: Return result
  SELECT jsonb_build_object(
    'operation_key', p_operation_key,
    'cost_credits', v_new_cost,
    'enabled', v_new_enabled,
    'audit_id', v_audit_id,
    'updated_at', now(),
    'idempotent', false
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_operation_cost(UUID, TEXT, INTEGER, BOOLEAN, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_operation_cost(UUID, TEXT, INTEGER, BOOLEAN, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- 5. Seeds de sistema (updated_by NULL — D2)
-- =============================================================================
INSERT INTO public.credit_operation_costs (operation_key, cost_credits, updated_by)
VALUES
  ('campaign_generation', 1, NULL),
  ('visual_signature_generation', 1, NULL)
ON CONFLICT (operation_key) DO NOTHING;

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.admin_update_operation_cost(UUID, TEXT, INTEGER, BOOLEAN, TEXT, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_update_operation_cost(UUID, TEXT, INTEGER, BOOLEAN, TEXT, UUID);
-- REVOKE ALL ON TABLE public.credit_operation_cost_audit FROM service_role;
-- REVOKE ALL ON TABLE public.credit_operation_costs FROM service_role;
-- DROP TRIGGER IF EXISTS trg_credit_operation_cost_audit_immutable ON public.credit_operation_cost_audit;
-- DROP FUNCTION IF EXISTS public.trg_credit_operation_cost_audit_immutable_fn();
-- DROP INDEX IF EXISTS public.idx_credit_operation_cost_audit_idempotency;
-- DROP TABLE IF EXISTS public.credit_operation_cost_audit;
-- DROP TRIGGER IF EXISTS trg_credit_operation_costs_updated_at ON public.credit_operation_costs;
-- DROP FUNCTION IF EXISTS public.update_credit_operation_costs_updated_at();
-- DROP TABLE IF EXISTS public.credit_operation_costs;
