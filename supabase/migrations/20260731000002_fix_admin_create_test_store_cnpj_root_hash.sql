-- Fix admin_create_test_store RPC — add p_cnpj_root_hash parameter (RAG-260730)
-- The chk_stores_cnpj_atomic CHECK constraint requires cnpj_root_hash != ''
-- whenever cnpj_normalized is not null. This migration adds the missing parameter
-- and validation to ensure the test store creation works with the constraint.

-- =============================================================================
-- Drop old signature to avoid overload ambiguity
-- =============================================================================
DROP FUNCTION IF EXISTS public.admin_create_test_store(
  p_user_id UUID, p_name TEXT, p_segment TEXT,
  p_cnpj_normalized TEXT, p_razao_social TEXT, p_nome_fantasia TEXT,
  p_city TEXT, p_state TEXT, p_granted_by UUID
);

-- =============================================================================
-- Recreate with p_cnpj_root_hash parameter
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_test_store(
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_cnpj_normalized TEXT,
  p_cnpj_root_hash TEXT,
  p_razao_social TEXT DEFAULT NULL,
  p_nome_fantasia TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_granted_by UUID DEFAULT NULL
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
  -- Explicit validation: if CNPJ is provided, root hash is required.
  -- This gives a clear error message instead of a cryptic CHECK constraint violation.
  IF p_cnpj_normalized IS NOT NULL AND (p_cnpj_root_hash IS NULL OR p_cnpj_root_hash = '') THEN
    RAISE EXCEPTION 'cnpj_root_hash_required';
  END IF;

  INSERT INTO public.stores (
    name, segment, user_id, city, state,
    cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia,
    is_test_store, verification_status
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state,
    p_cnpj_normalized, p_cnpj_root_hash, p_razao_social, p_nome_fantasia,
    true, 'approved'
  )
  RETURNING id INTO v_store_id;

  INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
  VALUES ('create_test_store', 'store', v_store_id, p_granted_by, 'Store de teste criada por admin',
    jsonb_build_object('user_id', p_user_id, 'name', p_name));

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = v_store_id) s;

  RETURN jsonb_build_object('success', true, 'store', v_store_data);
END;
$$;

-- =============================================================================
-- REVERT
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.admin_create_test_store(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);
-- CREATE OR REPLACE FUNCTION public.admin_create_test_store(
--   p_user_id UUID,
--   p_name TEXT,
--   p_segment TEXT,
--   p_cnpj_normalized TEXT,
--   p_razao_social TEXT DEFAULT NULL,
--   p_nome_fantasia TEXT DEFAULT NULL,
--   p_city TEXT DEFAULT NULL,
--   p_state TEXT DEFAULT NULL,
--   p_granted_by UUID DEFAULT NULL
-- )
-- RETURNS JSONB
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_store_id UUID;
--   v_store_data JSONB;
-- BEGIN
--   INSERT INTO public.stores (
--     name, segment, user_id, city, state,
--     cnpj_normalized, razao_social, nome_fantasia,
--     is_test_store, verification_status
--   ) VALUES (
--     p_name, p_segment, p_user_id, p_city, p_state,
--     p_cnpj_normalized, p_razao_social, p_nome_fantasia,
--     true, 'approved'
--   )
--   RETURNING id INTO v_store_id;

--   INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
--   VALUES ('create_test_store', 'store', v_store_id, p_granted_by, 'Store de teste criada por admin',
--     jsonb_build_object('user_id', p_user_id, 'name', p_name));

--   SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
--   FROM (SELECT * FROM public.stores WHERE id = v_store_id) s;

--   RETURN jsonb_build_object('success', true, 'store', v_store_data);
-- END;
-- $$;
