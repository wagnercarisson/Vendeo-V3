-- ============================================================================
-- verify-phase12.sql — Smoke tests for Phase 12 (Fundação DB/Storage)
-- ============================================================================
-- Execute against a Supabase instance with both Phase 12 migrations applied.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -f scripts/verify-phase12.sql
--   or paste into Supabase Studio SQL editor
--
-- Each block uses RAISE EXCEPTION for failure (fast-fail) and
-- RAISE NOTICE 'PASS: ...' for success.
--
-- UAT Technical Checklist (10 manual verifications):
--   1. Owner sees own campaigns via RLS (SELECT)
--   2. Other tenant sees 0 results (no data leak)
--   3. updated_at changes on UPDATE
--   4. status='error' without message is rejected (CHECK constraint)
--   5. Client-side INSERT into campaigns fails (no write policy for authenticated)
--   6. Bucket campaign-images is private (public URL fails with 404/403)
--   7. Client-side upload to campaign-images fails
--   8. Service_role can upload + delete from campaign-images
--   9. Signed URL allows reading (createSignedUrl returns 200)
--  10. Public URL does not work (returns 404/403)
-- ============================================================================

-- Block 1: Check campaigns table exists
DO $$
DECLARE
  tbl regclass;
BEGIN
  SELECT to_regclass('public.campaigns') INTO tbl;
  IF tbl IS NULL THEN
    RAISE EXCEPTION 'FAIL: campaigns table does not exist';
  END IF;
  RAISE NOTICE 'PASS: campaigns table exists';
END;
$$;

-- Block 2: Check RLS is enabled on campaigns
DO $$
DECLARE
  rls_enabled boolean;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE oid = 'public.campaigns'::regclass;

  IF rls_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on campaigns';
  END IF;
  RAISE NOTICE 'PASS: RLS is enabled on campaigns';
END;
$$;

-- Block 3: Check chk_campaigns_error_message constraint exists
DO $$
DECLARE
  found int;
BEGIN
  SELECT 1 INTO found
  FROM pg_constraint
  WHERE conname = 'chk_campaigns_error_message'
    AND conrelid = 'public.campaigns'::regclass;

  IF found IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: chk_campaigns_error_message constraint not found';
  END IF;
  RAISE NOTICE 'PASS: chk_campaigns_error_message constraint exists';
END;
$$;

-- Block 4: Check trg_campaigns_updated_at trigger exists
DO $$
DECLARE
  found int;
BEGIN
  SELECT 1 INTO found
  FROM pg_trigger
  WHERE tgname = 'trg_campaigns_updated_at'
    AND tgrelid = 'public.campaigns'::regclass;

  IF found IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: trg_campaigns_updated_at trigger not found';
  END IF;
  RAISE NOTICE 'PASS: trg_campaigns_updated_at trigger exists';
END;
$$;

-- Block 5: Check campaign-images bucket exists and is private
DO $$
DECLARE
  bucket_record record;
BEGIN
  SELECT id, public INTO bucket_record
  FROM storage.buckets
  WHERE id = 'campaign-images';

  IF bucket_record.id IS NULL THEN
    RAISE EXCEPTION 'FAIL: campaign-images bucket not found';
  END IF;

  IF bucket_record.public IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: campaign-images bucket is public (expected private)';
  END IF;

  RAISE NOTICE 'PASS: campaign-images bucket exists and is private';
END;
$$;

-- Block 6: Check owner_select_campaign_images policy exists
DO $$
DECLARE
  found int;
BEGIN
  SELECT 1 INTO found
  FROM pg_policies
  WHERE policyname = 'owner_select_campaign_images'
    AND tablename = 'objects'
    AND schemaname = 'storage';

  IF found IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: owner_select_campaign_images policy not found';
  END IF;
  RAISE NOTICE 'PASS: owner_select_campaign_images policy exists';
END;
$$;

-- Block 7: Check service_insert_campaign_images policy exists
DO $$
DECLARE
  found int;
BEGIN
  SELECT 1 INTO found
  FROM pg_policies
  WHERE policyname = 'service_insert_campaign_images'
    AND tablename = 'objects'
    AND schemaname = 'storage';

  IF found IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: service_insert_campaign_images policy not found';
  END IF;
  RAISE NOTICE 'PASS: service_insert_campaign_images policy exists';
END;
$$;

-- Block 8: Check service_delete_campaign_images policy exists
DO $$
DECLARE
  found int;
BEGIN
  SELECT 1 INTO found
  FROM pg_policies
  WHERE policyname = 'service_delete_campaign_images'
    AND tablename = 'objects'
    AND schemaname = 'storage';

  IF found IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: service_delete_campaign_images policy not found';
  END IF;
  RAISE NOTICE 'PASS: service_delete_campaign_images policy exists';
END;
$$;

-- Block 9: Check NO service_update_campaign_* policy exists (immutability)
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE policyname LIKE 'service_update_campaign%'
    AND tablename = 'objects'
    AND schemaname = 'storage';

  IF policy_count > 0 THEN
    RAISE EXCEPTION 'FAIL: UPDATE policy found (violates immutability) — % policy(ies) exist', policy_count;
  END IF;
  RAISE NOTICE 'PASS: No UPDATE policy exists on campaign-images (immutability preserved)';
END;
$$;
