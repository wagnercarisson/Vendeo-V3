-- Create generation_rate_events table for rate limiting
-- Records every generation attempt to enforce hourly/daily limits
-- Uses supabaseAdmin service role for INSERT operations

CREATE TABLE IF NOT EXISTS public.generation_rate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'generation_attempt',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index for rate limit queries: store + type + time
-- Supports fast lookups for "count in last hour/day" patterns
CREATE INDEX IF NOT EXISTS idx_generation_rate_events_lookup
  ON public.generation_rate_events (store_id, event_type, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.generation_rate_events ENABLE ROW LEVEL SECURITY;

-- Owner SELECT policy: owner can see only their own store's events
CREATE POLICY "owner_select_generation_rate_events" ON public.generation_rate_events
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())));

-- GRANT SELECT for RLS to work with authenticated role
-- INSERT is NOT granted — mutations via supabaseAdmin (service_role) only
GRANT SELECT ON TABLE public.generation_rate_events TO authenticated;
GRANT SELECT ON TABLE public.generation_rate_events TO service_role;

-- =============================================================================
-- REVERT
-- =============================================================================
-- REVOKE SELECT ON TABLE public.generation_rate_events FROM service_role;
-- REVOKE SELECT ON TABLE public.generation_rate_events FROM authenticated;
-- DROP POLICY IF EXISTS "owner_select_generation_rate_events" ON public.generation_rate_events;
-- ALTER TABLE public.generation_rate_events DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS idx_generation_rate_events_lookup;
-- DROP TABLE IF EXISTS public.generation_rate_events CASCADE;
