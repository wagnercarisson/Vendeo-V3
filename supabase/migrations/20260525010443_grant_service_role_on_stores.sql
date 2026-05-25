-- Grant only the permissions required by Store Identity Foundation.
-- This spec intentionally does not expose stores to anon/authenticated roles.

REVOKE ALL ON TABLE public.stores FROM anon;
REVOKE ALL ON TABLE public.stores FROM authenticated;
REVOKE ALL ON TABLE public.stores FROM service_role;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.stores
TO service_role;

-- REVERT:
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.stores FROM service_role;
