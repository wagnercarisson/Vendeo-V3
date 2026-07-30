-- Extend update_store_cnpj RPC with verification params (RAG-260729-t6x)
-- Adds support for persisting cnpj_official_data, verification_status, and related
-- verification columns when updating CNPJ for legacy stores.

-- =============================================================================
-- Drop old signature first to avoid overload ambiguity
-- =============================================================================
DROP FUNCTION IF EXISTS public.update_store_cnpj(UUID, TEXT, TEXT, TEXT, TEXT);

-- =============================================================================
-- Recreate with extended signature
-- =============================================================================
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
  p_verification_reasons TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_data JSONB;
  v_existing_hash TEXT;
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

  -- Legacy consumption marker (pre-F32): marks root CNPJ as having consumed onboarding.
  -- This is NOT a new benefit grant — it's a legacy tracking insert that prevents
  -- duplicate freemium onboarding for the same CNPJ root across store creation flows.
  INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason)
  VALUES (p_store_id, p_cnpj_root_hash, 'onboarding', 'legacy_pre_f32_onboarding_consumed')
  ON CONFLICT (root_hash, benefit_type, (COALESCE(cycle, '_nostring_')))
  DO NOTHING;

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object('store', v_store_data);
END;
$$;

-- =============================================================================
-- REVERT
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.update_store_cnpj(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, TEXT[]);
-- CREATE OR REPLACE FUNCTION public.update_store_cnpj(
--   p_store_id UUID,
--   p_cnpj_normalized TEXT,
--   p_cnpj_root_hash TEXT,
--   p_razao_social TEXT DEFAULT NULL,
--   p_nome_fantasia TEXT DEFAULT NULL
-- )
-- RETURNS JSONB
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_store_data JSONB;
--   v_existing_hash TEXT;
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
--     RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
--   END IF;
--   SELECT cnpj_root_hash INTO v_existing_hash FROM public.stores WHERE id = p_store_id;
--   IF v_existing_hash IS NOT NULL AND v_existing_hash != '' THEN
--     RAISE EXCEPTION 'cnpj_already_set' USING HINT = 'Esta loja já possui CNPJ cadastrado';
--   END IF;
--   UPDATE public.stores SET
--     cnpj_normalized = p_cnpj_normalized,
--     cnpj_root_hash = p_cnpj_root_hash,
--     razao_social = p_razao_social,
--     nome_fantasia = p_nome_fantasia
--   WHERE id = p_store_id;
--   INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason)
--   VALUES (p_store_id, p_cnpj_root_hash, 'onboarding', 'legacy_pre_f32_onboarding_consumed')
--   ON CONFLICT (root_hash, benefit_type, (COALESCE(cycle, '_nostring_')))
--   DO NOTHING;
--   SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
--   FROM (SELECT * FROM public.stores WHERE id = p_store_id) s;
--   RETURN jsonb_build_object('store', v_store_data);
-- END;
-- $$;
