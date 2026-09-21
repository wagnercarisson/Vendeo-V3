-- F50 D20 — Storage privacy hardening.
-- campaign-images/lab-artifacts remain private; the three legacy identity buckets
-- become private and are read through signed URLs generated at read-time.

-- Inventory: campaign-images (private), lab-artifacts (private),
-- store-brand-assets (public -> private), visual-signatures (public -> private),
-- store-logos (public -> private).

DROP POLICY IF EXISTS "brand_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "visual_signatures_public_read" ON storage.objects;
DROP POLICY IF EXISTS "store_logos_public_read" ON storage.objects;

UPDATE storage.buckets
SET public = false
WHERE id IN ('store-brand-assets', 'visual-signatures', 'store-logos');

ALTER TABLE public.store_visual_signatures
  ALTER COLUMN asset_url DROP NOT NULL;

COMMENT ON COLUMN public.store_visual_signatures.asset_url IS
  'DEPRECATED: legacy URL only. storage_path is canonical; signed URLs are generated at read-time and never persisted.';

-- REVERT (PARTIAL): restoring NOT NULL requires a backfill of every NULL asset_url
-- first. New rows intentionally keep asset_url NULL because storage_path is canonical.
-- Do not run the final ALTER below without a reviewed backfill/cutover plan.
-- UPDATE storage.buckets SET public = true
-- WHERE id IN ('store-brand-assets', 'visual-signatures', 'store-logos');
-- CREATE POLICY "brand_assets_public_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'store-brand-assets');
-- CREATE POLICY "visual_signatures_public_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'visual-signatures');
-- CREATE POLICY "store_logos_public_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'store-logos');
-- ALTER TABLE public.store_visual_signatures
--   ALTER COLUMN asset_url SET NOT NULL;
