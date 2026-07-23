-- Migration: Create privacy_acknowledgements table
-- Records user's acknowledgement of privacy policy at signup time
-- PK = user_id (one acknowledgement per user, upserted on re-acknowledgement)

CREATE TABLE public.privacy_acknowledgements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  privacy_policy_version TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL
);

ALTER TABLE public.privacy_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage privacy acknowledgements"
  ON public.privacy_acknowledgements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own privacy acknowledgement"
  ON public.privacy_acknowledgements
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- REVERT
-- DROP TABLE IF EXISTS public.privacy_acknowledgements CASCADE;
