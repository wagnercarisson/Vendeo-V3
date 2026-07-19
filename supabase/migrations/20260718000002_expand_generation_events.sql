-- Expand generation_events for pipeline telemetry (Phase 28)
-- ALTER CHECK constraint to accept new generation_type values
-- ADD COLUMNS for campaign tracking and AI token accounting
-- All new columns are nullable — zero breakage for existing rows

-- Step 1: Drop existing CHECK constraint
ALTER TABLE public.generation_events
DROP CONSTRAINT IF EXISTS chk_generation_events_type;

-- Step 2: Add new CHECK constraint with expanded values
ALTER TABLE public.generation_events
ADD CONSTRAINT chk_generation_events_type
CHECK (generation_type IN (
  'visual_signature',
  'brand_profile_without_logo',
  'brand_profile_with_logo',
  'campaign_pipeline',
  'campaign_copy',
  'campaign_image'
));

-- Step 3: Add new columns (all nullable)
ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id);

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS completion_tokens INTEGER;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS total_tokens INTEGER;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS trace_id TEXT;

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS phase TEXT;

-- =============================================================================
-- REVERT
-- =============================================================================
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS phase;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS trace_id;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS total_tokens;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS completion_tokens;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS prompt_tokens;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS user_id;
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS campaign_id;
-- ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_generation_events_type;
-- ALTER TABLE public.generation_events
--   ADD CONSTRAINT chk_generation_events_type
--   CHECK (generation_type IN ('visual_signature', 'brand_profile_without_logo', 'brand_profile_with_logo'));
