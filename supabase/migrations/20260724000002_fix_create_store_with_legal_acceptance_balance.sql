-- Fix: column reference "balance" is ambiguous in create_store_with_legal_acceptance.
-- The function set search_path = '' and declared local variables (store_id, balance)
-- that shadow column names in referenced tables (credit_balances.balance,
-- credit_balances.store_id, etc.), causing 500 errors at runtime.
--
-- Also grant_credits may be called with an ambiguous store_id reference.
-- The full fix: prefix ALL local variables with v_ to eliminate any shadowing
-- against column names, and use table aliases for column qualification.
--
-- See: 30-UAT.md issue #1 (Test 5 failed with 500 on POST /api/store)

-- Step 1: DROP remaining stale overloads to guarantee no ambiguity in PostgREST
-- schema cache.
DROP FUNCTION IF EXISTS public.create_store_with_initial_grant(
  p_name TEXT,
  p_segment TEXT,
  p_user_id UUID,
  p_city TEXT,
  p_state TEXT,
  p_brand_color TEXT,
  p_logo_url TEXT,
  p_subsegment TEXT,
  p_tone_of_voice TEXT,
  p_positioning TEXT,
  p_short_description TEXT,
  p_slogan TEXT
);

DROP FUNCTION IF EXISTS public.create_store_with_initial_grant(
  p_name TEXT,
  p_segment TEXT,
  p_user_id UUID,
  p_city TEXT,
  p_state TEXT,
  p_brand_color TEXT,
  p_logo_url TEXT,
  p_subsegment TEXT,
  p_tone_of_voice TEXT,
  p_positioning TEXT,
  p_short_description TEXT,
  p_slogan TEXT,
  p_initial_grant_amount INTEGER
);

-- Step 2: Recreate with renamed local variables (v_ prefix) and qualified columns.
CREATE OR REPLACE FUNCTION public.create_store_with_legal_acceptance(
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_city TEXT,
  p_state TEXT,
  p_accepted_by_user_id UUID,
  p_terms_version TEXT,
  p_acceptable_use_version TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT,
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
  v_balance INTEGER;
BEGIN
  INSERT INTO public.stores (
    name, segment, user_id, city, state, brand_color, logo_url,
    subsegment, tone_of_voice, positioning, short_description, slogan
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan
  )
  RETURNING id INTO v_store_id;

  INSERT INTO public.legal_acceptances (
    store_id, accepted_by_user_id, document_type, document_version,
    ip_address, user_agent, acceptance_source
  ) VALUES
    (v_store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version,
     p_ip_address, p_user_agent, 'onboarding'),
    (v_store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version,
     p_ip_address, p_user_agent, 'onboarding');

  PERFORM public.grant_credits(
    v_store_id,
    p_initial_grant_amount,
    'onboarding',
    'onboarding_' || v_store_id,
    '{}'::jsonb
  );

  SELECT COALESCE(cb.balance, 0) INTO v_balance
  FROM public.credit_balances cb
  WHERE cb.store_id = v_store_id;

  SELECT jsonb_build_object(
    'id', v_store_id,
    'name', p_name,
    'segment', p_segment,
    'balance', v_balance
  ) INTO v_store_data;

  RETURN v_store_data;
END;
$$;

-- Step 3: Restrict execution to service_role only (defensive re-apply).
REVOKE EXECUTE ON FUNCTION public.create_store_with_legal_acceptance(
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_city TEXT,
  p_state TEXT,
  p_accepted_by_user_id UUID,
  p_terms_version TEXT,
  p_acceptable_use_version TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_brand_color TEXT,
  p_logo_url TEXT,
  p_subsegment TEXT,
  p_tone_of_voice TEXT,
  p_positioning TEXT,
  p_short_description TEXT,
  p_slogan TEXT,
  p_initial_grant_amount INTEGER
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_store_with_legal_acceptance(
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_city TEXT,
  p_state TEXT,
  p_accepted_by_user_id UUID,
  p_terms_version TEXT,
  p_acceptable_use_version TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_brand_color TEXT,
  p_logo_url TEXT,
  p_subsegment TEXT,
  p_tone_of_voice TEXT,
  p_positioning TEXT,
  p_short_description TEXT,
  p_slogan TEXT,
  p_initial_grant_amount INTEGER
) TO service_role;

-- REVERT
-- DROP FUNCTION IF EXISTS public.create_store_with_legal_acceptance CASCADE;
