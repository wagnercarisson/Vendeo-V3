-- Create the store_visual_signatures table for visual signature lifecycle management
-- Supports draft → active → archived status flow with partial unique index for active
-- Uses specific trigger function (NOT generic)

CREATE TABLE IF NOT EXISTS public.store_visual_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  asset_url TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  generation_mode TEXT,
  prompt TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Enforce valid type values
  CONSTRAINT chk_store_visual_signatures_type CHECK (type IN ('ai_generated', 'automatic_generated', 'fallback_typographic')),

  -- Enforce valid status values
  CONSTRAINT chk_store_visual_signatures_status CHECK (status IN ('draft', 'active', 'archived')),

  -- Enforce valid generation_mode values (nullable)
  CONSTRAINT chk_store_visual_signatures_generation_mode CHECK (
    generation_mode IS NULL OR generation_mode IN ('user_choice', 'automatic', 'fallback')
  )
);

-- Specific trigger function for this table (NOT a generic one per project convention)
CREATE OR REPLACE FUNCTION public.update_store_visual_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on row change
CREATE TRIGGER trg_store_visual_signatures_updated_at
BEFORE UPDATE ON public.store_visual_signatures
FOR EACH ROW
EXECUTE FUNCTION public.update_store_visual_signatures_updated_at();

-- Partial unique index: at most one active signature per store
CREATE UNIQUE INDEX ON public.store_visual_signatures (store_id) WHERE status = 'active';

-- Index for non-active lookups (draft/archived listings)
CREATE INDEX ON public.store_visual_signatures (store_id);

-- REVERT:
-- DROP TRIGGER IF EXISTS trg_store_visual_signatures_updated_at ON public.store_visual_signatures;
-- DROP FUNCTION IF EXISTS public.update_store_visual_signatures_updated_at();
-- DROP TABLE IF EXISTS public.store_visual_signatures;
