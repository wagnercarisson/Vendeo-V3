-- Create the visual-signatures bucket for storing generated visual signature assets
-- Path structure: {store_id}/{uuid}.png or {store_id}/{uuid}.svg
-- Public read, service_role write

-- Insert the bucket (idempotent — skip if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'visual-signatures',
  'visual-signatures',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Public read policy: anyone can read visual signature assets
CREATE POLICY "visual_signatures_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'visual-signatures');

-- Service role insert policy: only server-side via supabaseAdmin
CREATE POLICY "visual_signatures_service_insert"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'visual-signatures');

-- Service role update policy: only server-side via supabaseAdmin
CREATE POLICY "visual_signatures_service_update"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'visual-signatures')
WITH CHECK (bucket_id = 'visual-signatures');

-- Service role delete policy: only server-side via supabaseAdmin
CREATE POLICY "visual_signatures_service_delete"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'visual-signatures');

-- REVERT:
-- DROP POLICY IF EXISTS "visual_signatures_public_read" ON storage.objects;
-- DROP POLICY IF EXISTS "visual_signatures_service_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "visual_signatures_service_update" ON storage.objects;
-- DROP POLICY IF EXISTS "visual_signatures_service_delete" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'visual-signatures';
