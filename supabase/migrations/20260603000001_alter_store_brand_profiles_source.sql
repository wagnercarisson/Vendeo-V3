-- Alter store_brand_profiles CHECK constraint to accept 'without_logo' source
-- Add new columns for without-logo flow: visual_signature_id, inferred colors, art director output

-- Drop existing CHECK constraint
ALTER TABLE public.store_brand_profiles
  DROP CONSTRAINT IF EXISTS chk_store_brand_profiles_source;

-- Re-add with new source value for without-logo flow
ALTER TABLE public.store_brand_profiles
  ADD CONSTRAINT chk_store_brand_profiles_source
  CHECK (source IN ('logo_analysis', 'without_logo'));

-- Add new optional columns for without-logo flow
ALTER TABLE public.store_brand_profiles
  ADD COLUMN IF NOT EXISTS visual_signature_id UUID REFERENCES public.store_visual_signatures(id),
  ADD COLUMN IF NOT EXISTS inferred_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS inferred_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS identity_art_director_output JSONB DEFAULT '{}'::jsonb;

-- Index for visual_signature_id FK lookups
CREATE INDEX IF NOT EXISTS idx_store_brand_profiles_visual_signature_id
  ON public.store_brand_profiles (visual_signature_id);

-- REVERT:
-- DROP INDEX IF EXISTS idx_store_brand_profiles_visual_signature_id;
-- ALTER TABLE public.store_brand_profiles DROP COLUMN IF EXISTS identity_art_director_output;
-- ALTER TABLE public.store_brand_profiles DROP COLUMN IF EXISTS inferred_accent_color;
-- ALTER TABLE public.store_brand_profiles DROP COLUMN IF EXISTS inferred_primary_color;
-- ALTER TABLE public.store_brand_profiles DROP COLUMN IF EXISTS visual_signature_id;
-- ALTER TABLE public.store_brand_profiles DROP CONSTRAINT IF EXISTS chk_store_brand_profiles_source;
-- ALTER TABLE public.store_brand_profiles ADD CONSTRAINT chk_store_brand_profiles_source CHECK (source IN ('logo_analysis'));
