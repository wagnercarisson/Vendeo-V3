-- ============================================================================
-- verify-phase12.sql — Smoke tests for Phase 12 (Fundação DB/Storage)
-- ============================================================================
-- Execute against a Supabase instance with both Phase 12 migrations applied.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -f scripts/verify-phase12.sql
--   or paste into Supabase Studio SQL editor (results appear as table rows)
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

-- Create temp table to collect results
CREATE TEMP TABLE IF NOT EXISTS _verify12_results (check_id text, status text, detail text);
TRUNCATE _verify12_results;

-- Block 1: Check campaigns table exists
DO $$
DECLARE
  tbl regclass;
BEGIN
  SELECT to_regclass('public.campaigns') INTO tbl;
  IF tbl IS NULL THEN
    INSERT INTO _verify12_results VALUES ('1', 'FAIL', 'campaigns table does not exist');
  ELSE
    INSERT INTO _verify12_results VALUES ('1', 'PASS', 'campaigns table exists');
  END IF;
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
    INSERT INTO _verify12_results VALUES ('2', 'FAIL', 'RLS not enabled on campaigns');
  ELSE
    INSERT INTO _verify12_results VALUES ('2', 'PASS', 'RLS is enabled on campaigns');
  END IF;
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
    INSERT INTO _verify12_results VALUES ('3', 'FAIL', 'chk_campaigns_error_message constraint not found');
  ELSE
    INSERT INTO _verify12_results VALUES ('3', 'PASS', 'chk_campaigns_error_message constraint exists');
  END IF;
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
    INSERT INTO _verify12_results VALUES ('4', 'FAIL', 'trg_campaigns_updated_at trigger not found');
  ELSE
    INSERT INTO _verify12_results VALUES ('4', 'PASS', 'trg_campaigns_updated_at trigger exists');
  END IF;
END;
$$;

-- Block 5: Check campaign-images bucket exists and is private
DO $$
DECLARE
  b_id text;
  b_public boolean;
BEGIN
  SELECT id::text, public INTO b_id, b_public
  FROM storage.buckets
  WHERE id = 'campaign-images';

  IF b_id IS NULL THEN
    INSERT INTO _verify12_results VALUES ('5', 'FAIL', 'campaign-images bucket not found');
  ELSIF b_public IS DISTINCT FROM false THEN
    INSERT INTO _verify12_results VALUES ('5', 'FAIL', 'campaign-images bucket is public (expected private)');
  ELSE
    INSERT INTO _verify12_results VALUES ('5', 'PASS', 'campaign-images bucket exists and is private');
  END IF;
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
    INSERT INTO _verify12_results VALUES ('6', 'FAIL', 'owner_select_campaign_images policy not found');
  ELSE
    INSERT INTO _verify12_results VALUES ('6', 'PASS', 'owner_select_campaign_images policy exists');
  END IF;
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
    INSERT INTO _verify12_results VALUES ('7', 'FAIL', 'service_insert_campaign_images policy not found');
  ELSE
    INSERT INTO _verify12_results VALUES ('7', 'PASS', 'service_insert_campaign_images policy exists');
  END IF;
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
    INSERT INTO _verify12_results VALUES ('8', 'FAIL', 'service_delete_campaign_images policy not found');
  ELSE
    INSERT INTO _verify12_results VALUES ('8', 'PASS', 'service_delete_campaign_images policy exists');
  END IF;
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
    INSERT INTO _verify12_results VALUES ('9', 'FAIL', format('UPDATE policy found (violates immutability) — %s policy(ies) exist', policy_count));
  ELSE
    INSERT INTO _verify12_results VALUES ('9', 'PASS', 'No UPDATE policy exists on campaign-images (immutability preserved)');
  END IF;
END;
$$;

-- Show all results
SELECT * FROM _verify12_results ORDER BY check_id;

-- Drop temp table
DROP TABLE IF EXISTS _verify12_results;
