-- RPC function: create store + grant initial 5 credits atomically
-- Uses SECURITY DEFINER to bypass RLS for credit operations
-- Atomic: if grant fails, store creation rolls back

CREATE OR REPLACE FUNCTION public.create_store_with_initial_grant(
  p_name TEXT,
  p_segment TEXT,
  p_user_id UUID,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_brand_color TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_subsegment TEXT DEFAULT NULL,
  p_tone_of_voice TEXT DEFAULT NULL,
  p_positioning TEXT DEFAULT NULL,
  p_short_description TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  store_id UUID;
  store_data JSONB;
  balance INTEGER;
BEGIN
  -- Insert store
  INSERT INTO public.stores (
    name, segment, user_id, city, state, brand_color, logo_url,
    subsegment, tone_of_voice, positioning, short_description, slogan
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan
  )
  RETURNING id INTO store_id;

  -- Grant initial 5 credits (idempotent via onboarding_ prefix)
  PERFORM public.grant_credits(
    store_id,
    5,
    'onboarding',
    'onboarding_' || store_id,
    '{}'::jsonb
  );

  -- Read back balance
  SELECT COALESCE(balance, 0) INTO balance
  FROM public.credit_balances
  WHERE store_id = store_id;

  -- Build response
  SELECT jsonb_build_object(
    'id', store_id,
    'name', p_name,
    'segment', p_segment,
    'balance', balance
  ) INTO store_data;

  RETURN store_data;
END;
$$;

-- =============================================================================
-- REVERT
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.create_store_with_initial_grant CASCADE;
