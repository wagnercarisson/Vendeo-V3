-- Grant service_role permissions on generation_events table.
-- Following the same pattern as other migrations: revoke all, then grant specific.

REVOKE ALL ON TABLE public.generation_events FROM anon;
REVOKE ALL ON TABLE public.generation_events FROM authenticated;
REVOKE ALL ON TABLE public.generation_events FROM service_role;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.generation_events
TO service_role;

-- REVERT:
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.generation_events FROM service_role;
