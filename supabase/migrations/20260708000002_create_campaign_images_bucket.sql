-- Create the campaign-images bucket for rendered campaign images
-- Path structure: {storeId}/{campaignId}.png
-- Private bucket: no public read, access via signed URL only
-- NO UPDATE policy: campaign images are immutable once written (invariante #1)
-- Client-side upload REJECTED: only service_role via supabaseAdmin

-- Insert the bucket (idempotent — skip if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-images',
  'campaign-images',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Owner SELECT policy: owner can list/inspect campaign images by store prefix
CREATE POLICY "owner_select_campaign_images"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'campaign-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid())
  )
);

-- Service role INSERT policy: only server-side via supabaseAdmin post-generation
CREATE POLICY "service_insert_campaign_images"
ON storage.objects
FOR INSERT TO service_role
WITH CHECK (bucket_id = 'campaign-images');

-- Service role DELETE policy: only server-side via supabaseAdmin (cleanup, partial failures)
CREATE POLICY "service_delete_campaign_images"
ON storage.objects
FOR DELETE TO service_role
USING (bucket_id = 'campaign-images');

-- NOTA: NENHUMA policy FOR UPDATE em campaign-images.
-- A imagem final da campanha é imutável (invariante #1 da milestone v1.3).
-- Se upload for bem-sucedido no Storage mas UPDATE no banco falhar,
-- retry no mesmo storage_path requer DELETE + re-upload (não upsert/overwrite).

-- REVERT:
-- DROP POLICY IF EXISTS "service_delete_campaign_images" ON storage.objects;
-- DROP POLICY IF EXISTS "service_insert_campaign_images" ON storage.objects;
-- DROP POLICY IF EXISTS "owner_select_campaign_images" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'campaign-images';
