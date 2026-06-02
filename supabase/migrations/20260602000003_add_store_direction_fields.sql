-- Add marketing direction fields to stores table (Phase 4.4.1)
-- All columns are nullable TEXT, no CHECK constraints on these free-form fields

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS subsegment TEXT,
  ADD COLUMN IF NOT EXISTS tone_of_voice TEXT,
  ADD COLUMN IF NOT EXISTS positioning TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS slogan TEXT;

-- REVERT:
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS subsegment;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS tone_of_voice;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS positioning;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS short_description;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS slogan;
