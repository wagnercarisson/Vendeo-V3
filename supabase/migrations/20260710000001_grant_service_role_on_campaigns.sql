-- Grant service_role permissions on campaigns table.
-- Following the same pattern as other migrations: revoke all, then grant specific.

REVOKE ALL ON TABLE public.campaigns FROM anon;
REVOKE ALL ON TABLE public.campaigns FROM authenticated;
REVOKE ALL ON TABLE public.campaigns FROM service_role;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.campaigns
TO service_role;

-- REVERT:
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.campaigns FROM service_role;
