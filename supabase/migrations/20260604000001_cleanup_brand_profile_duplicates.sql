-- Clean up duplicate brand profiles per visual_signature_id and prevent future duplicates
--
-- Problem: persistProfile always INSERTed before the UPSERT fix, creating
-- multiple profiles for the same visual_signature_id. The .maybeSingle()
-- queries return null when multiple rows match, defeating profile reuse
-- and causing infinite re-creation loops.
--
-- Fix: 1) Delete duplicates (keep most recent per visual_signature_id + source)
--      2) Add unique index to prevent future duplicates

-- Step 1: Delete duplicate profiles for source='without_logo'
-- Keep only the most recent row per (store_id, visual_signature_id, source)
DELETE FROM public.store_brand_profiles
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY store_id, visual_signature_id, source
        ORDER BY updated_at DESC
      ) AS rn
    FROM public.store_brand_profiles
    WHERE source = 'without_logo'
      AND visual_signature_id IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- Step 2: Add unique index to prevent future duplicates
-- At most one profile per (store_id, visual_signature_id, source) for without_logo
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_brand_profiles_unique_per_signature
  ON public.store_brand_profiles (store_id, visual_signature_id, source)
  WHERE source = 'without_logo';

-- REVERT:
-- DROP INDEX IF EXISTS idx_store_brand_profiles_unique_per_signature;
-- (Deleted rows cannot be restored — run from backup if needed)
