-- Adiciona grant_type na metadata do audit log (F29.3)
-- Migration incremental: não altera a migration original já aplicada.
-- Apenas faz CREATE OR REPLACE do admin_grant_credits para incluir
-- 'grant_type', 'admin_grant' no jsonb_build_object da metadata.

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
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'store_not_found';
  END IF;

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

  v_transaction_id := public.grant_credits(
    p_store_id,
    p_amount,
    p_reason,
    'admin_grant_' || p_operation_id,
    p_metadata
  );

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id,
    metadata
  ) VALUES (
    p_actor_id, 'credit_grant', 'store', p_store_id, p_reason, p_operation_id,
    jsonb_build_object(
      'amount', p_amount,
      'transaction_id', v_transaction_id,
      'grant_type', 'admin_grant'
    )
  );

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
