-- Create the store_brand_assets table for logo upload versioning and technical variants
-- Each asset (original + each technical variant) is an independent record
-- Supports active/archived/failed status flow
-- Uses specific trigger function (NOT generic)

CREATE TABLE IF NOT EXISTS public.store_brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL DEFAULT 'logo',
  variant_type TEXT NOT NULL,
  source TEXT NOT NULL,
  parent_asset_id UUID REFERENCES public.store_brand_assets(id),
  storage_path TEXT,
  mime_type TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_store_brand_assets_status CHECK (status IN ('active', 'archived', 'failed')),
  CONSTRAINT chk_store_brand_assets_variant_type CHECK (variant_type IN ('original', 'normalized', 'on_light', 'on_dark', 'square_safe', 'horizontal_safe')),
  CONSTRAINT chk_store_brand_assets_source CHECK (source IN ('user_upload', 'system_generated')),
  CONSTRAINT chk_store_brand_assets_asset_type CHECK (asset_type IN ('logo')),
  CONSTRAINT chk_store_brand_assets_storage_path CHECK (
    (status = 'failed' AND storage_path IS NULL) OR (status != 'failed' AND storage_path IS NOT NULL)
  )
);

-- Specific trigger function for this table (NOT a generic one per project convention)
CREATE OR REPLACE FUNCTION public.update_store_brand_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on row change
CREATE TRIGGER trg_store_brand_assets_updated_at
BEFORE UPDATE ON public.store_brand_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_store_brand_assets_updated_at();

-- Partial unique index: at most one active asset per store/asset_type/variant_type
CREATE UNIQUE INDEX ON public.store_brand_assets (store_id, asset_type, variant_type) WHERE status = 'active';

-- Index for store-based lookups
CREATE INDEX ON public.store_brand_assets (store_id);

-- REVERT:
-- DROP TRIGGER IF EXISTS trg_store_brand_assets_updated_at ON public.store_brand_assets;
-- DROP FUNCTION IF EXISTS public.update_store_brand_assets_updated_at();
-- DROP TABLE IF EXISTS public.store_brand_assets;
