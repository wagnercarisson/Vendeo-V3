-- Create the store-logos bucket for storing uploaded store logos
-- Path structure: {store_id}/{uuid}.ext
-- Public read, service_role write

-- Insert the bucket (idempotent — skip if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-logos',
  'store-logos',
  true,
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Public read policy: anyone can read store logos
CREATE POLICY "store_logos_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'store-logos');

-- Service role insert policy: only server-side via supabaseAdmin
CREATE POLICY "store_logos_service_insert"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'store-logos');

-- Service role update policy: only server-side via supabaseAdmin
CREATE POLICY "store_logos_service_update"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'store-logos')
WITH CHECK (bucket_id = 'store-logos');

-- Service role delete policy: only server-side via supabaseAdmin
CREATE POLICY "store_logos_service_delete"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'store-logos');

-- REVERT:
-- DROP POLICY IF EXISTS "store_logos_public_read" ON storage.objects;
-- DROP POLICY IF EXISTS "store_logos_service_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "store_logos_service_update" ON storage.objects;
-- DROP POLICY IF EXISTS "store_logos_service_delete" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'store-logos';
