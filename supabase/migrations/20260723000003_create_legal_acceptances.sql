-- Migration: Create legal_acceptances table + create_store_with_legal_acceptance RPC
-- Records contractual acceptance of Terms of Service and Acceptable Use per store

-- Step 1: legal_acceptances table
CREATE TABLE public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  accepted_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('terms_of_service', 'acceptable_use')),
  document_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  acceptance_source TEXT NOT NULL CHECK (acceptance_source IN ('onboarding', 'login_reacceptance', 'admin_invite')),
  UNIQUE(store_id, accepted_by_user_id, document_type, document_version)
);

CREATE INDEX idx_legal_acceptances_store ON public.legal_acceptances(store_id, document_type);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages legal acceptances"
  ON public.legal_acceptances
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own store legal acceptances"
  ON public.legal_acceptances
  FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE user_id = auth.uid()
    )
  );

-- Step 2: Drop existing RPC to avoid overload ambiguity
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

-- Step 3: New atomic RPC with legal acceptance
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

  INSERT INTO public.legal_acceptances (
    store_id, accepted_by_user_id, document_type, document_version,
    ip_address, user_agent, acceptance_source
  ) VALUES
    (store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version,
     p_ip_address, p_user_agent, 'onboarding'),
    (store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version,
     p_ip_address, p_user_agent, 'onboarding');

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

-- Step 4: Restrict execution to service_role only
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
-- DROP TABLE IF EXISTS public.legal_acceptances CASCADE;
-- DROP FUNCTION IF EXISTS public.create_store_with_legal_acceptance CASCADE;
