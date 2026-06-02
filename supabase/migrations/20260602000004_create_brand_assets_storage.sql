-- Create the store-brand-assets bucket for logo uploads and technical variants
-- Path structure: {store_id}/{variant_type}/{uuid}.ext
-- Public read, service_role write, 5MB limit, PNG/JPG/WEBP only

-- Insert the bucket (idempotent — skip if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-brand-assets',
  'store-brand-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Public read policy: anyone can read brand assets (campaign rendering)
CREATE POLICY "brand_assets_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'store-brand-assets');

-- Service role insert policy: only server-side via supabaseAdmin
CREATE POLICY "brand_assets_service_insert"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'store-brand-assets');

-- Service role update policy: only server-side via supabaseAdmin
CREATE POLICY "brand_assets_service_update"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'store-brand-assets')
WITH CHECK (bucket_id = 'store-brand-assets');

-- Service role delete policy: only server-side via supabaseAdmin
CREATE POLICY "brand_assets_service_delete"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'store-brand-assets');

-- REVERT:
-- DROP POLICY IF EXISTS "brand_assets_public_read" ON storage.objects;
-- DROP POLICY IF EXISTS "brand_assets_service_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "brand_assets_service_update" ON storage.objects;
-- DROP POLICY IF EXISTS "brand_assets_service_delete" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'store-brand-assets';
