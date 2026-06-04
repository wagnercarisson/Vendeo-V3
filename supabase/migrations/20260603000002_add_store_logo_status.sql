-- Add logo_status and visual_signature_attempts columns to stores table (Phase 4.4.2)
-- logo_status tracks the visual identity state for stores without uploaded logo
-- visual_signature_attempts counts how many visual signature versions were generated

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logo_status TEXT;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS visual_signature_attempts INTEGER NOT NULL DEFAULT 0;

-- Optional CHECK constraint for logo_status valid values
ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS chk_stores_logo_status;

ALTER TABLE public.stores
  ADD CONSTRAINT chk_stores_logo_status
  CHECK (
    logo_status IS NULL OR
    logo_status IN ('uploaded', 'generated', 'explicit_none', 'failed', 'exhausted')
  );

-- REVERT:
-- ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_logo_status;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS visual_signature_attempts;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS logo_status;
