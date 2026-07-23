-- Migration: Create user_consent_events table (append-only)
-- Records LGPD consent events for commercial communications
-- Append-only: only INSERT is possible from application layer (no UPDATE/DELETE policies for non-service-role)

CREATE TABLE public.user_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('commercial_communications')),
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_version TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('signup', 'account_settings'))
);

CREATE INDEX idx_user_consent_events_user ON public.user_consent_events(user_id, consent_type, occurred_at DESC);

ALTER TABLE public.user_consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages consent events"
  ON public.user_consent_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users view own consent events"
  ON public.user_consent_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- REVERT
-- DROP TABLE IF EXISTS public.user_consent_events CASCADE;
