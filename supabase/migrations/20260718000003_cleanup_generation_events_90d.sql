-- Create cleanup function for generation_events (90-day retention, Phase 28)
-- Defines the function but does NOT execute it — run manually:
--   SELECT public.cleanup_generation_events_90d();
-- Scheduled job deferred to D+30 or Phase 29.

CREATE OR REPLACE FUNCTION public.cleanup_generation_events_90d()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public.generation_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- =============================================================================
-- REVERT
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.cleanup_generation_events_90d CASCADE;
