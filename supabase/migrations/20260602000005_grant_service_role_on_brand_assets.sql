-- Grant only the permissions required by Brand Assets & Profiles (Phase 4.4.1).
-- No DELETE — the flow uses soft delete (status = 'archived').
-- Matches existing stores and store_visual_signatures grant patterns.

REVOKE ALL ON TABLE public.store_brand_assets FROM anon;
REVOKE ALL ON TABLE public.store_brand_assets FROM authenticated;
REVOKE ALL ON TABLE public.store_brand_assets FROM service_role;

REVOKE ALL ON TABLE public.store_brand_profiles FROM anon;
REVOKE ALL ON TABLE public.store_brand_profiles FROM authenticated;
REVOKE ALL ON TABLE public.store_brand_profiles FROM service_role;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.store_brand_assets
TO service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.store_brand_profiles
TO service_role;

-- REVERT:
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.store_brand_profiles FROM service_role;
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.store_brand_assets FROM service_role;
