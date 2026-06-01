-- Grant only the permissions required by Store Visual Signature.
-- Matching the existing stores table pattern — no anon/authenticated access.

REVOKE ALL ON TABLE public.store_visual_signatures FROM anon;
REVOKE ALL ON TABLE public.store_visual_signatures FROM authenticated;
REVOKE ALL ON TABLE public.store_visual_signatures FROM service_role;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.store_visual_signatures
TO service_role;

-- REVERT:
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.store_visual_signatures FROM service_role;
