-- Create the store_brand_profiles table for AI-inferred brand identity
-- Each store has at most one active (synced) profile
-- Supports synced/outdated/failed/archived status flow
-- Uses specific trigger function (NOT generic)

CREATE TABLE IF NOT EXISTS public.store_brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'logo_analysis',
  active_logo_asset_id UUID REFERENCES public.store_brand_assets(id),
  logo_colors_detected JSONB DEFAULT '[]'::jsonb,
  brand_colors_chosen JSONB DEFAULT '[]'::jsonb,
  safe_color_tokens JSONB DEFAULT '{}'::jsonb,
  visual_style TEXT,
  visual_tone TEXT,
  typography_direction TEXT,
  brand_personality TEXT,
  campaign_guidelines TEXT,
  campaign_brief TEXT,
  confidence_score REAL,
  metadata JSONB DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_store_brand_profiles_status CHECK (status IN ('processing', 'synced', 'outdated', 'failed', 'archived')),
  CONSTRAINT chk_store_brand_profiles_source CHECK (source IN ('logo_analysis'))
);

-- Specific trigger function for this table (NOT a generic one per project convention)
CREATE OR REPLACE FUNCTION public.update_store_brand_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on row change
CREATE TRIGGER trg_store_brand_profiles_updated_at
BEFORE UPDATE ON public.store_brand_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_store_brand_profiles_updated_at();

-- Partial unique index: at most one active (synced) profile per store
CREATE UNIQUE INDEX ON public.store_brand_profiles (store_id) WHERE status = 'synced';

-- Index for store-based lookups (non-synced)
CREATE INDEX ON public.store_brand_profiles (store_id);

-- REVERT:
-- DROP TRIGGER IF EXISTS trg_store_brand_profiles_updated_at ON public.store_brand_profiles;
-- DROP FUNCTION IF EXISTS public.update_store_brand_profiles_updated_at();
-- DROP TABLE IF EXISTS public.store_brand_profiles;
