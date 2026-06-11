-- ⚠ DESTRUCTIVE — DEVELOPMENT ONLY
-- Clean all data before applying phase 4.5 migration
-- Order respects foreign key dependencies (dependents first)

TRUNCATE TABLE public.generation_events CASCADE;
TRUNCATE TABLE public.store_brand_profiles CASCADE;
TRUNCATE TABLE public.store_brand_assets CASCADE;
TRUNCATE TABLE public.store_visual_signatures CASCADE;
TRUNCATE TABLE public.stores CASCADE;

-- Clean storage buckets
DELETE FROM storage.objects WHERE bucket_id IN ('visual-signatures', 'store-logos', 'store-brand-assets');
