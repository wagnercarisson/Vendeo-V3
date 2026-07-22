-- V2: Parametrize initial grant amount with p_initial_grant_amount DEFAULT 10.
-- Motivation: increase onboarding grant from 5 to 10 credits without editing
-- applied migrations (20260717000002, 20260717000003).
-- After applying, reload PostgREST schema via:
--   NOTIFY pgrst, 'reload schema';

-- Step 1: Drop old 12-parameter signature so CREATE OR REPLACE doesn't leave
-- a stale overload that PostgREST could resolve for callers omitting the new param.
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

-- Step 2: Recreate with p_initial_grant_amount parameter (default 10).
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
  p_slogan TEXT DEFAULT NULL,
  p_initial_grant_amount INTEGER DEFAULT 10
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
  INSERT INTO public.stores (
    name, segment, user_id, city, state, brand_color, logo_url,
    subsegment, tone_of_voice, positioning, short_description, slogan
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan
  )
  RETURNING id INTO store_id;

  PERFORM public.grant_credits(
    store_id,
    p_initial_grant_amount,
    'onboarding',
    'onboarding_' || store_id,
    '{}'::jsonb
  );

  SELECT COALESCE(balance, 0) INTO balance
  FROM public.credit_balances
  WHERE credit_balances.store_id = store_id;

  SELECT jsonb_build_object(
    'id', store_id,
    'name', p_name,
    'segment', p_segment,
    'balance', balance
  ) INTO store_data;

  RETURN store_data;
END;
$$;

-- Step 3: Restrict execution to service_role only.
-- The backend route uses supabaseAdmin (service_role), so the flow continues
-- working. Direct calls from anon/authenticated clients are blocked.
REVOKE EXECUTE ON FUNCTION public.create_store_with_initial_grant(
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
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_store_with_initial_grant(
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
) TO service_role;

-- REVERT
-- DROP FUNCTION IF EXISTS public.create_store_with_initial_grant CASCADE;
